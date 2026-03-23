// Role: orchestrates module-scoped daily-practice set creation, hydration, submit flows, and session lifecycle behind one backend facade.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type QuestionAttempt } from '@prisma/client';
import {
  type DailyPracticeSelectionBucket,
  DailyPracticeAlgorithmVersionValues,
  PracticeSessionTypeValues,
} from '@scholarxp/api-contracts';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeRoomAttemptService } from '../practice-room/practice-room-attempt.service';
import { PracticeRoomSessionService } from '../practice-room/practice-session.service';
import { QuestProgressService } from '../quests/quest-progress.service';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
import { DailyPracticeFsrsStateService } from './daily-practice-fsrs-state.service';
import { DailyPracticeMasteryExpService } from './daily-practice-mastery-exp.service';
import { DailyPracticeEligibilityService } from './daily-practice-eligibility.service';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import { DailyPracticeMapper } from './daily-practice.mapper';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import { DailyPracticeVariantResolverService } from './daily-practice-variant-resolver.service';
import { SubmitDailyPracticeAttemptDto } from './dto/submit-daily-practice-attempt.dto';
import type {
  OrderedDailyPracticeQuestionRecord,
  PersistedDailyPracticeSetRecord,
} from './daily-practice.types';

const ZERO_AWARDS = {
  baseQuestionExp: 0,
  firstAttemptBonus: 0,
  streakBonus: 0,
  masteryExp: 0,
  accountExp: 0,
} as const;

type DailyPracticeQuestionAttemptSnapshot = Pick<
  QuestionAttempt,
  'questionId' | 'studentAnswer' | 'isCorrect' | 'attemptedAt' | 'hintsUsed'
>;

@Injectable()
export class DailyPracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyPracticeSetReadService: DailyPracticeSetReadService,
    private readonly dailyPracticeSetSelectorService: DailyPracticeSetSelectorService,
    private readonly dailyPracticeInterleavingService: DailyPracticeInterleavingService,
    private readonly dailyPracticeFsrsGradeService: DailyPracticeFsrsGradeService,
    private readonly dailyPracticeFsrsStateService: DailyPracticeFsrsStateService,
    private readonly dailyPracticeMasteryExpService: DailyPracticeMasteryExpService,
    private readonly dailyPracticeEligibilityService: DailyPracticeEligibilityService,
    private readonly dailyPracticeMapper: DailyPracticeMapper,
    private readonly dailyPracticeVariantResolverService: DailyPracticeVariantResolverService,
    private readonly practiceRoomAttemptService: PracticeRoomAttemptService,
    private readonly practiceRoomSessionService: PracticeRoomSessionService,
    private readonly questProgressService: QuestProgressService,
  ) {}

  // "Today" either loads the stable persisted snapshot or creates it once, then hydrates the set with the active daily-practice session.
  async getTodayDailyPractice(
    moduleId: number,
    studentId: number,
    existingSessionId?: string,
  ) {
    const now = new Date();
    await this.dailyPracticeEligibilityService.assertEligibleForToday(
      moduleId,
      studentId,
      now,
    );
    const dailyPracticeSet = await this.getOrCreateTodaySet(
      moduleId,
      studentId,
      now,
    );
    const session =
      await this.practiceRoomSessionService.resolveOwnedSessionByType(
        moduleId,
        studentId,
        PracticeSessionTypeValues.dailyPractice,
        existingSessionId,
      );
    const hydratedState = await this.loadHydratedSetState(
      dailyPracticeSet,
      studentId,
      moduleId,
    );

    return this.dailyPracticeMapper.buildTodayResponse({
      setId: dailyPracticeSet.id,
      moduleId,
      practiceDateUtc: dailyPracticeSet.practiceDateUtc,
      sessionId: session.id,
      sessionType: PracticeSessionTypeValues.dailyPractice,
      algorithmVersion: dailyPracticeSet.algorithmVersion,
      currentStreak: hydratedState.currentStreak,
      highestStreak: hydratedState.highestStreak,
      progress: hydratedState.progress,
      questions: hydratedState.questions,
    });
  }

  // Submit flow reuses canonical grading and attempt persistence, while daily practice adds set ownership and one-update-per-day FSRS behavior.
  async submitAttempt(
    moduleId: number,
    studentId: number,
    payload: SubmitDailyPracticeAttemptDto,
  ) {
    const dailyPracticeSet =
      await this.dailyPracticeSetReadService.findOwnedSetById(
        payload.setId,
        studentId,
        moduleId,
      );

    if (!dailyPracticeSet) {
      throw new NotFoundException(
        'Daily practice set not found for this module.',
      );
    }

    const setItem = dailyPracticeSet.items.find(
      (item) =>
        item.questionUnitId === payload.questionUnitId &&
        item.moduleUnitId === payload.moduleUnitId,
    );
    if (!setItem) {
      throw new NotFoundException(
        "Question not found in today's daily practice set.",
      );
    }
    if (setItem.questionContentId !== payload.questionContentId) {
      throw new BadRequestException(
        'Submitted question content does not match the daily practice set.',
      );
    }

    const session =
      await this.practiceRoomSessionService.getOwnedPracticeSessionOrThrow(
        moduleId,
        studentId,
        payload.sessionId,
      );
    this.practiceRoomSessionService.assertSessionMatchesType(
      session.sessionType,
      PracticeSessionTypeValues.dailyPractice,
    );
    this.practiceRoomSessionService.assertSessionAllowsSubmissions(
      session.sessionType,
    );

    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getUtcDayBounds(
      dailyPracticeSet.practiceDateUtc,
    );
    const isCorrect =
      await this.practiceRoomAttemptService.computeIsCorrectForPayload(
        payload.moduleUnitId,
        payload.questionUnitId,
        payload.questionContentId,
        payload.studentAnswer,
        { allowVariantContent: true },
      );
    const attemptedAt = new Date();
    const encounterGrade =
      this.dailyPracticeFsrsGradeService.mapEncounterToGrade({
        firstAttemptCorrect: isCorrect,
        hintUnlocked: payload.hintUnlocked,
      });

    const progress = await this.prisma.$transaction(async (tx) => {
      const hadAnyDailyAttemptBeforeSubmit = await tx.questionAttempt.findFirst(
        {
          where: {
            studentId,
            questionId: payload.questionUnitId,
            attemptedAt: {
              gte: dayStartUtc,
              lt: nextDayStartUtc,
            },
            session: {
              moduleId,
              userId: studentId,
              sessionType: PracticeSessionTypeValues.dailyPractice,
            },
          },
          select: { id: true },
        },
      );
      const hadCorrectDailyAttemptBeforeSubmit =
        await tx.questionAttempt.findFirst({
          where: {
            studentId,
            questionId: payload.questionUnitId,
            isCorrect: true,
            attemptedAt: {
              gte: dayStartUtc,
              lt: nextDayStartUtc,
            },
            session: {
              moduleId,
              userId: studentId,
              sessionType: PracticeSessionTypeValues.dailyPractice,
            },
          },
          select: { id: true },
        });

      await this.practiceRoomAttemptService.createAttemptRecord(
        payload.moduleUnitId,
        studentId,
        payload,
        isCorrect,
        attemptedAt,
        tx,
      );

      // FSRS state is updated at most once per day — subsequent retries on the same question don't re-grade.
      // Mastery XP evaluation piggybacks on the same guard since it depends on the updated FSRS state.
      let masteryExpAwarded = 0;
      if (!hadAnyDailyAttemptBeforeSubmit) {
        const updatedState =
          await this.dailyPracticeFsrsStateService.applyEncounter(
            {
              userId: studentId,
              moduleId,
              moduleUnitId: payload.moduleUnitId,
              questionUnitId: payload.questionUnitId,
              reviewedAt: attemptedAt,
              firstAttemptCorrect: isCorrect,
              hintUnlocked: payload.hintUnlocked,
              timeTakenMs: payload.timeTakenMs,
            },
            tx,
          );

        const masteryResult =
          await this.dailyPracticeMasteryExpService.evaluateAndAward(
            {
              userId: studentId,
              moduleId,
              moduleUnitId: payload.moduleUnitId,
              questionUnitId: payload.questionUnitId,
              sessionId: payload.sessionId,
              updatedState,
            },
            tx,
          );
        masteryExpAwarded = masteryResult.masteryExpAwarded;
      }

      const todaysAttempts = await tx.questionAttempt.findMany({
        where: {
          studentId,
          questionId: {
            in: dailyPracticeSet.items.map((item) => item.questionUnitId),
          },
          attemptedAt: { gte: dayStartUtc, lt: nextDayStartUtc },
          session: {
            moduleId,
            userId: studentId,
            sessionType: PracticeSessionTypeValues.dailyPractice,
          },
        },
        orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
        select: { questionId: true, isCorrect: true, hintsUsed: true },
      });
      const streak = this.computeDailyPracticeStreak(todaysAttempts);

      return this.syncProgressForSet(
        dailyPracticeSet,
        studentId,
        moduleId,
        attemptedAt,
        tx,
      )
        .then((progressSnapshot) => ({
          progressSnapshot,
          hasCorrectAttempt:
            Boolean(hadCorrectDailyAttemptBeforeSubmit) || isCorrect,
          streak,
        }))
        .then(async ({ progressSnapshot, hasCorrectAttempt, streak }) => {
          await this.questProgressService.recordDailyPracticeSetProgress(
            {
              userId: studentId,
              moduleId,
              progressedAt: attemptedAt,
            },
            tx,
          );

          return {
            progressSnapshot,
            hasCorrectAttempt,
            streak,
            masteryExpAwarded,
          };
        });
    });

    return this.dailyPracticeMapper.buildSubmitResponse({
      awards: { ...ZERO_AWARDS, masteryExp: progress.masteryExpAwarded },
      hasCorrectAttempt: progress.hasCorrectAttempt,
      currentStreak: progress.streak.currentStreak,
      highestStreak: progress.streak.highestStreak,
      progress: progress.progressSnapshot,
      encounterGrade,
    });
  }

  // Explicit close mirrors the practice-room unload-safe contract while returning the latest set progress snapshot for the module/day.
  async closeSession(moduleId: number, studentId: number, sessionId: string) {
    const closeResult = await this.practiceRoomSessionService.closeOwnedSession(
      moduleId,
      studentId,
      sessionId,
    );
    const dailyPracticeSet =
      await this.dailyPracticeSetReadService.findSetForUtcDay(
        studentId,
        moduleId,
        new Date(),
      );
    if (!dailyPracticeSet) {
      throw new NotFoundException(
        'Daily practice set not found for this module.',
      );
    }

    const hydratedState = await this.loadHydratedSetState(
      dailyPracticeSet,
      studentId,
      moduleId,
    );

    return this.dailyPracticeMapper.buildCloseResponse({
      sessionId: closeResult.sessionId,
      closedAt: closeResult.closedAt,
      progress: hydratedState.progress,
    });
  }

  private async getOrCreateTodaySet(
    moduleId: number,
    studentId: number,
    timestamp: Date,
  ): Promise<PersistedDailyPracticeSetRecord> {
    const existingSet = await this.dailyPracticeSetReadService.findSetForUtcDay(
      studentId,
      moduleId,
      timestamp,
    );
    if (existingSet) {
      // An empty set is a sentinel created when no questions were available on the day it was first checked.
      // Re-throwing here keeps today's "no set" state stable even if questions become eligible later in the day.
      if (existingSet.items.length === 0) {
        throw new NotFoundException(
          'No daily practice questions are available for this module yet.',
        );
      }
      return existingSet;
    }

    const orderedQuestions = await this.buildOrderedSelection(
      moduleId,
      studentId,
      timestamp,
    );
    const resolvedQuestions =
      await this.dailyPracticeVariantResolverService.resolveQuestionContentIds(
        studentId,
        orderedQuestions,
      );
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(timestamp);

    if (resolvedQuestions.length === 0) {
      // Persist an empty sentinel row so the unique constraint prevents re-generation later today.
      // P2002 means a concurrent request already wrote the sentinel; either way we throw 404.
      try {
        await this.prisma.dailyPracticeSet.create({
          data: {
            userId: studentId,
            moduleId,
            practiceDateUtc: dayStartUtc,
            algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
          },
          select: { id: true },
        });
      } catch (error) {
        if (
          !(
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          )
        ) {
          throw error;
        }
      }
      throw new NotFoundException(
        'No daily practice questions are available for this module yet.',
      );
    }

    try {
      const createdSet = await this.prisma.dailyPracticeSet.create({
        data: {
          userId: studentId,
          moduleId,
          practiceDateUtc: dayStartUtc,
          algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
          items: {
            create: resolvedQuestions.map((question) => ({
              questionUnitId: question.questionUnitId,
              questionContentId: question.questionContentId,
              moduleUnitId: question.moduleUnitId,
              position: question.position,
              selectionReason: question.selectionReason,
              selectionScore: question.selectionScore,
              sourceBucket: question.sourceBucket,
            })),
          },
        },
        select: { id: true },
      });

      const persistedSet = await this.dailyPracticeSetReadService.findSetById(
        createdSet.id,
      );
      if (persistedSet) {
        return persistedSet;
      }
    } catch (error) {
      // P2002 means a concurrent request already created the set for this day; return that row instead of failing.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentSet =
          await this.dailyPracticeSetReadService.findSetForUtcDay(
            studentId,
            moduleId,
            timestamp,
          );
        if (concurrentSet) {
          // Edge case: concurrent request may have written an empty sentinel instead of a real set.
          if (concurrentSet.items.length === 0) {
            throw new NotFoundException(
              'No daily practice questions are available for this module yet.',
            );
          }
          return concurrentSet;
        }
      }

      throw error;
    }

    throw new NotFoundException('Daily practice set could not be loaded.');
  }

  private async buildOrderedSelection(
    moduleId: number,
    studentId: number,
    timestamp: Date,
  ): Promise<OrderedDailyPracticeQuestionRecord[]> {
    const selection =
      await this.dailyPracticeSetSelectorService.selectQuestions({
        userId: studentId,
        moduleId,
        now: timestamp,
      });

    return this.dailyPracticeInterleavingService.orderSelectedQuestions(
      selection.selectedQuestions,
    );
  }

  private async loadHydratedSetState(
    dailyPracticeSet: PersistedDailyPracticeSetRecord,
    studentId: number,
    moduleId: number,
  ) {
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getUtcDayBounds(
      dailyPracticeSet.practiceDateUtc,
    );
    const questionUnitIds = dailyPracticeSet.items.map(
      (item) => item.questionUnitId,
    );
    const questionContentIds = dailyPracticeSet.items.map(
      (item) => item.questionContentId,
    );
    const questionContents = await this.prisma.questionContent.findMany({
      where: {
        id: { in: questionContentIds },
        isArchived: false,
        questionUnit: {
          is: {
            id: {
              in: questionUnitIds,
            },
            isArchived: false,
          },
        },
      },
      select: {
        id: true,
        questionUnitId: true,
        type: true,
        questionStem: true,
        questionData: true,
        hint: true,
        difficultyScore: true,
        questionUnit: {
          select: {
            id: true,
            moduleUnit: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });
    const attempts = questionUnitIds.length
      ? await this.prisma.questionAttempt.findMany({
          where: {
            studentId,
            questionId: { in: questionUnitIds },
            attemptedAt: {
              gte: dayStartUtc,
              lt: nextDayStartUtc,
            },
            session: {
              moduleId,
              userId: studentId,
              sessionType: PracticeSessionTypeValues.dailyPractice,
            },
          },
          orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
          select: {
            questionId: true,
            studentAnswer: true,
            isCorrect: true,
            attemptedAt: true,
            hintsUsed: true,
          },
        })
      : [];

    const questionContentById = new Map(
      questionContents.map((questionContent) => [
        questionContent.id,
        questionContent,
      ]),
    );
    const latestAttemptByQuestionId = new Map<
      number,
      DailyPracticeQuestionAttemptSnapshot
    >();
    const correctQuestionIds = new Set<number>();
    const answeredQuestionIds = new Set<number>();

    // Attempts are ordered newest-first; the first entry per questionId is therefore the latest attempt.
    for (const attempt of attempts) {
      answeredQuestionIds.add(attempt.questionId);
      if (attempt.isCorrect) {
        correctQuestionIds.add(attempt.questionId);
      }

      if (!latestAttemptByQuestionId.has(attempt.questionId)) {
        latestAttemptByQuestionId.set(attempt.questionId, attempt);
      }
    }

    const questions = dailyPracticeSet.items.map((item) => {
      const questionContent = questionContentById.get(item.questionContentId);
      if (
        !questionContent ||
        questionContent.questionUnitId !== item.questionUnitId ||
        !questionContent.questionUnit.moduleUnit
      ) {
        throw new NotFoundException(
          'Daily practice question content is no longer available.',
        );
      }

      return {
        questionUnitId: item.questionUnitId,
        moduleUnitId: item.moduleUnitId,
        moduleUnitTitle: questionContent.questionUnit.moduleUnit.title,
        position: item.position,
        hasCorrectAttempt: correctQuestionIds.has(item.questionUnitId)
          ? true
          : null,
        sourceBucket: item.sourceBucket as DailyPracticeSelectionBucket,
        coreQuestion: {
          questionId: item.questionUnitId,
          questionContent: {
            id: questionContent.id,
            type: questionContent.type,
            questionStem: questionContent.questionStem,
            questionData:
              questionContent.questionData as unknown as import('@scholarxp/question-type-dtos').QuestionData,
            hint: questionContent.hint,
            difficultyScore: questionContent.difficultyScore,
          },
          lastAttempt:
            latestAttemptByQuestionId.get(item.questionUnitId) ?? null,
        },
      };
    });

    // Attempts are newest-first; reverse for chronological streak computation.
    const streak = this.computeDailyPracticeStreak([...attempts].reverse());

    return {
      progress: {
        totalQuestions: dailyPracticeSet.items.length,
        answeredQuestions: answeredQuestionIds.size,
        completedAt: dailyPracticeSet.completedAt,
      },
      questions,
      currentStreak: streak.currentStreak,
      highestStreak: streak.highestStreak,
    };
  }

  // Mirrors the quest system's streak logic: first attempt per question, correct and no hints used.
  // Returns both the live count and the session high so the client can drive the streak indicator.
  private computeDailyPracticeStreak(
    attempts: Array<{
      questionId: number;
      isCorrect: boolean;
      hintsUsed: number;
    }>,
  ): { currentStreak: number; highestStreak: number } {
    const seenQuestionIds = new Set<number>();
    let currentStreak = 0;
    let highestStreak = 0;

    for (const attempt of attempts) {
      if (seenQuestionIds.has(attempt.questionId)) {
        continue;
      }
      seenQuestionIds.add(attempt.questionId);

      if (attempt.isCorrect && attempt.hintsUsed === 0) {
        currentStreak += 1;
        highestStreak = Math.max(highestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return { currentStreak, highestStreak };
  }

  private async syncProgressForSet(
    dailyPracticeSet: PersistedDailyPracticeSetRecord,
    studentId: number,
    moduleId: number,
    attemptedAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getUtcDayBounds(
      dailyPracticeSet.practiceDateUtc,
    );
    const answeredAttempts = await tx.questionAttempt.findMany({
      where: {
        studentId,
        questionId: {
          in: dailyPracticeSet.items.map((item) => item.questionUnitId),
        },
        attemptedAt: {
          gte: dayStartUtc,
          lt: nextDayStartUtc,
        },
        session: {
          moduleId,
          userId: studentId,
          sessionType: PracticeSessionTypeValues.dailyPractice,
        },
      },
      select: {
        questionId: true,
      },
    });
    const answeredQuestionIds = new Set(
      answeredAttempts.map((attempt) => attempt.questionId),
    );
    // Preserve the original completedAt timestamp if the set was already finished; only stamp it on the first completion.
    const completedAt =
      answeredQuestionIds.size >= dailyPracticeSet.items.length
        ? (dailyPracticeSet.completedAt ?? attemptedAt)
        : dailyPracticeSet.completedAt;

    // Only write to the DB when the completedAt value actually changes to avoid unnecessary updates.
    if (
      completedAt &&
      (!dailyPracticeSet.completedAt ||
        dailyPracticeSet.completedAt.getTime() !== completedAt.getTime())
    ) {
      await tx.dailyPracticeSet.update({
        where: {
          id: dailyPracticeSet.id,
        },
        data: {
          completedAt,
        },
      });
    }

    return {
      totalQuestions: dailyPracticeSet.items.length,
      answeredQuestions: answeredQuestionIds.size,
      completedAt,
    };
  }
}
