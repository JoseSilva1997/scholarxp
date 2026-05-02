// Role: orchestrates module-scoped daily-practice set reads, hydration, submit flows, and session lifecycle behind one backend facade.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, type QuestionAttempt } from '@prisma/client';
import {
  type DailyPracticeSelectionBucket,
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
import { DailyPracticeMapper } from './daily-practice.mapper';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import { SubmitDailyPracticeAttemptDto } from './dto/submit-daily-practice-attempt.dto';
import type { DailyPracticeStatusSummary } from '@scholarxp/api-contracts';
import type { PersistedDailyPracticeSetRecord } from './daily-practice.types';

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
    private readonly dailyPracticeFsrsGradeService: DailyPracticeFsrsGradeService,
    private readonly dailyPracticeFsrsStateService: DailyPracticeFsrsStateService,
    private readonly dailyPracticeMasteryExpService: DailyPracticeMasteryExpService,
    private readonly dailyPracticeEligibilityService: DailyPracticeEligibilityService,
    private readonly dailyPracticeMapper: DailyPracticeMapper,
    private readonly practiceRoomAttemptService: PracticeRoomAttemptService,
    private readonly practiceRoomSessionService: PracticeRoomSessionService,
    private readonly questProgressService: QuestProgressService,
  ) {}

  // Request reads stay load-only so scheduled generation, not student traffic, defines the day's module snapshot.
  async getTodayDailyPractice(
    moduleId: number,
    studentId: number,
    existingSessionId?: string,
  ) {
    const now = new Date();
    const timezone = await this.loadTimezone(studentId);
    await this.dailyPracticeEligibilityService.assertEligibleForToday(
      moduleId,
      studentId,
      now,
      timezone,
    );
    const dailyPracticeSet = await this.getTodaySetOrThrow(
      moduleId,
      studentId,
      now,
      timezone,
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
      timezone,
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

  // Lightweight read-only status check for embedding into module summary responses.
  // Does not create a set or session — only reports the current state.
  async getDailyPracticeStatus(
    moduleId: number,
    studentId: number,
  ): Promise<DailyPracticeStatusSummary> {
    const now = new Date();
    const timezone = await this.loadTimezone(studentId);
    const eligibility =
      await this.dailyPracticeEligibilityService.checkEligibilityForToday(
        moduleId,
        studentId,
        now,
        timezone,
      );

    if (!eligibility.eligible) {
      return { status: 'locked', message: eligibility.message };
    }

    const set = await this.dailyPracticeSetReadService.findSetForUtcDay(
      studentId,
      moduleId,
      now,
      timezone,
    );

    if (!set || set.items.length === 0) {
      return {
        status: 'no_set',
        message:
          'No daily practice questions are available for this module yet.',
      };
    }

    if (set.completedAt) {
      return {
        status: 'completed',
        progress: {
          totalQuestions: set.items.length,
          answeredQuestions: set.items.length,
          completedAt: set.completedAt.toISOString(),
        },
      };
    }

    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      now,
      timezone,
    );
    const answeredAttempts = await this.prisma.questionAttempt.findMany({
      where: {
        studentId,
        questionId: { in: set.items.map((item) => item.questionUnitId) },
        attemptedAt: { gte: dayStartUtc, lt: nextDayStartUtc },
        session: {
          moduleId,
          userId: studentId,
          sessionType: PracticeSessionTypeValues.dailyPractice,
        },
      },
      distinct: ['questionId'],
      select: { questionId: true },
    });
    const answeredQuestions = answeredAttempts.length;

    return {
      status: answeredQuestions > 0 ? 'in_progress' : 'available',
      progress: {
        totalQuestions: set.items.length,
        answeredQuestions,
        completedAt: null,
      },
    };
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

    const timezone = await this.loadTimezone(studentId);
    // practiceDateUtc stores the local calendar date at UTC midnight; getLocalDayBounds converts it to the actual UTC window.
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      dailyPracticeSet.practiceDateUtc,
      timezone,
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
    // Surface-level grade for the submit response: the state service is the source of truth for recorded grades (including acquisition-biased seed grading). This display compute keeps the client's simple pass/hint/clean signal without re-loading acquisition evidence here.
    const encounterGrade =
      this.dailyPracticeFsrsGradeService.mapEncounterToGrade({
        isCorrect,
        hintUnlocked: payload.hintUnlocked,
        isSeeding: false,
        priorFailedInAcquisition: 0,
        priorHintedInAcquisition: 0,
        timeTakenMs: payload.timeTakenMs,
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

      // FSRS state is updated at most once per day — subsequent retries on the same question don't re-grade. The state service gates re-grading internally via priorEncounterExists, so late-correct attempts can still seed a card that earlier wrong attempts deferred.
      // Mastery XP only fires when state actually transitions or seeds (updatedState != null).
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
            timezone,
            priorEncounterExists: Boolean(hadAnyDailyAttemptBeforeSubmit),
          },
          tx,
        );

      let masteryExpAwarded = 0;
      if (updatedState) {
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
        timezone,
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
    const timezone = await this.loadTimezone(studentId);
    const dailyPracticeSet =
      await this.dailyPracticeSetReadService.findSetForUtcDay(
        studentId,
        moduleId,
        new Date(),
        timezone,
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
      timezone,
    );

    return this.dailyPracticeMapper.buildCloseResponse({
      sessionId: closeResult.sessionId,
      closedAt: closeResult.closedAt,
      progress: hydratedState.progress,
    });
  }

  // Loads the persisted set for the current local day, throwing the same NotFound for both "never generated" and the empty-sentinel case so the API does not leak generation internals.
  private async getTodaySetOrThrow(
    moduleId: number,
    studentId: number,
    timestamp: Date,
    timezone: string,
  ): Promise<PersistedDailyPracticeSetRecord> {
    const existingSet = await this.dailyPracticeSetReadService.findSetForUtcDay(
      studentId,
      moduleId,
      timestamp,
      timezone,
    );

    // The read API intentionally hides whether today's absence came from no generation run yet
    // or from an empty sentinel because both mean the learner has no set to load right now.
    if (!existingSet || existingSet.items.length === 0) {
      throw new NotFoundException(
        'No daily practice questions are available for this module yet.',
      );
    }

    return existingSet;
  }

  // Hydrates the persisted set with question content, the day's attempts, the latest attempt per question, and the streak so controller responses can be assembled in one pass.
  private async loadHydratedSetState(
    dailyPracticeSet: PersistedDailyPracticeSetRecord,
    studentId: number,
    moduleId: number,
    timezone: string,
  ) {
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      dailyPracticeSet.practiceDateUtc,
      timezone,
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

  // Loaded once per public method so all subordinate calls share one consistent timezone value.
  private async loadTimezone(studentId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { timezone: true },
    });
    return user?.timezone ?? 'UTC';
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

  // Recomputes answered count and stamps completedAt exactly once per set so progress writes stay idempotent across resubmissions.
  private async syncProgressForSet(
    dailyPracticeSet: PersistedDailyPracticeSetRecord,
    studentId: number,
    moduleId: number,
    attemptedAt: Date,
    timezone: string,
    tx: Prisma.TransactionClient,
  ) {
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      dailyPracticeSet.practiceDateUtc,
      timezone,
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
