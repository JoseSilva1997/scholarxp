// Role: orchestrates module-scoped daily-practice set creation, hydration, submit flows, and session lifecycle behind one backend facade.
import { Injectable, NotFoundException } from '@nestjs/common';
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
import { DailyPracticeEligibilityService } from './daily-practice-eligibility.service';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import { DailyPracticeMapper } from './daily-practice.mapper';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import { SubmitDailyPracticeAttemptDto } from './dto/submit-daily-practice-attempt.dto';
import type {
  OrderedDailyPracticeQuestionRecord,
  PersistedDailyPracticeSetRecord,
} from './daily-practice.types';

const ZERO_AWARDS = {
  baseQuestionExp: 0,
  firstAttemptBonus: 0,
  streakBonus: 0,
  accountExp: 0,
} as const;

type DailyPracticeQuestionAttemptSnapshot = Pick<
  QuestionAttempt,
  'questionId' | 'studentAnswer' | 'isCorrect' | 'attemptedAt'
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
    private readonly dailyPracticeEligibilityService: DailyPracticeEligibilityService,
    private readonly dailyPracticeMapper: DailyPracticeMapper,
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

      if (!hadAnyDailyAttemptBeforeSubmit) {
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
      }

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
        }))
        .then(async ({ progressSnapshot, hasCorrectAttempt }) => {
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
          };
        });
    });

    return this.dailyPracticeMapper.buildSubmitResponse({
      awards: { ...ZERO_AWARDS },
      hasCorrectAttempt: progress.hasCorrectAttempt,
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
      return existingSet;
    }

    const orderedQuestions = await this.buildOrderedSelection(
      moduleId,
      studentId,
      timestamp,
    );
    if (orderedQuestions.length === 0) {
      throw new NotFoundException(
        'No daily practice questions are available for this module yet.',
      );
    }

    const { dayStartUtc } = DateHelpers.getUtcDayBounds(timestamp);

    try {
      const createdSet = await this.prisma.dailyPracticeSet.create({
        data: {
          userId: studentId,
          moduleId,
          practiceDateUtc: dayStartUtc,
          algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
          items: {
            create: orderedQuestions.map((question) => ({
              questionUnitId: question.questionUnitId,
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
    const questionUnits = await this.prisma.questionUnit.findMany({
      where: {
        id: { in: questionUnitIds },
        isArchived: false,
      },
      select: {
        id: true,
        moduleUnitId: true,
        contents: {
          where: {
            isCore: true,
            isArchived: false,
          },
          orderBy: { id: 'asc' },
          take: 1,
          select: {
            id: true,
            type: true,
            questionStem: true,
            questionData: true,
            hint: true,
            difficultyScore: true,
          },
        },
        moduleUnit: {
          select: {
            id: true,
            title: true,
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
          },
        })
      : [];

    const questionUnitById = new Map(
      questionUnits.map((questionUnit) => [questionUnit.id, questionUnit]),
    );
    const latestAttemptByQuestionId = new Map<
      number,
      DailyPracticeQuestionAttemptSnapshot
    >();
    const correctQuestionIds = new Set<number>();
    const answeredQuestionIds = new Set<number>();

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
      const questionUnit = questionUnitById.get(item.questionUnitId);
      const coreContent = questionUnit?.contents[0];
      if (!questionUnit?.moduleUnit || !coreContent) {
        throw new NotFoundException(
          'Daily practice question content is no longer available.',
        );
      }

      return {
        questionUnitId: item.questionUnitId,
        moduleUnitId: item.moduleUnitId,
        moduleUnitTitle: questionUnit.moduleUnit.title,
        position: item.position,
        hasCorrectAttempt: correctQuestionIds.has(item.questionUnitId)
          ? true
          : null,
        sourceBucket: item.sourceBucket as DailyPracticeSelectionBucket,
        coreQuestion: {
          questionId: questionUnit.id,
          questionContent: {
            id: coreContent.id,
            type: coreContent.type,
            questionStem: coreContent.questionStem,
            questionData:
              coreContent.questionData as unknown as import('@scholarxp/question-type-dtos').QuestionData,
            hint: coreContent.hint,
            difficultyScore: coreContent.difficultyScore,
          },
          lastAttempt:
            latestAttemptByQuestionId.get(item.questionUnitId) ?? null,
        },
      };
    });

    return {
      progress: {
        totalQuestions: dailyPracticeSet.items.length,
        answeredQuestions: answeredQuestionIds.size,
        completedAt: dailyPracticeSet.completedAt,
      },
      questions,
    };
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
    const completedAt =
      answeredQuestionIds.size >= dailyPracticeSet.items.length
        ? (dailyPracticeSet.completedAt ?? attemptedAt)
        : dailyPracticeSet.completedAt;

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
