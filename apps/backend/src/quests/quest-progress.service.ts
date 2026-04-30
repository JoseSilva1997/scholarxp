// Role: owns quest completion events so future UI triggers can stay thin and backend rules remain centralized.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  QuestTypeValues,
  PracticeSessionTypeValues,
  getQuestDefinition,
  type QuestType,
} from '@scholarxp/api-contracts';
import {
  ExpLedgerEventTypes,
  MAX_DAILY_QUEST_COUNT,
  QUEST_COMPLETION_REWARD,
} from '@scholarxp/constants';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { QuestGenerationService } from './quest-generation.service';
import { QuestStreakService } from './quest-streak.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

type RecordDailyRevisionButtonClickParams = {
  userId: number;
  moduleId: number;
  clickedAt: Date;
};

type RecordModuleUnitCompletionParams = {
  userId: number;
  moduleId: number;
  completedAt: Date;
};

type RecordCompletedUnitReviewParams = {
  userId: number;
  moduleId: number;
  moduleUnitId: number;
  viewedAt: Date;
};

type RecordRetrySessionProgressParams = {
  userId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  attemptedAt: Date;
};

type RecordDailyPracticeSetProgressParams = {
  userId: number;
  moduleId: number;
  progressedAt: Date;
};

type UserLocalDayContext = {
  timestamp: Date;
  dayStartDb: Date;
  dayStartUtc: Date;
  nextDayStartUtc: Date;
};

type PersistedQuest = {
  id: number;
  userId: number;
  moduleId: number | null;
  moduleUnitId: number | null;
  type: QuestType;
  expGranted: number;
  isCompleted: boolean;
  questDateUtc: Date;
};

@Injectable()
export class QuestProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questGenerationService: QuestGenerationService,
    private readonly expLedgerService: ExpLedgerService,
    private readonly avatarService: AvatarService,
    private readonly questStreakService: QuestStreakService,
  ) {}

  // Daily revision clicks will eventually come from the dedicated daily-revision room entry button.
  async recordDailyRevisionButtonClick(
    params: RecordDailyRevisionButtonClickParams,
    tx?: PrismaClientLike,
  ): Promise<void> {
    const prismaClient = tx ?? this.prisma;
    await this.questGenerationService.ensureQuestDayGeneratedForUser(
      params.userId,
      params.clickedAt,
      prismaClient,
    );

    const dayContext = await this.getUserLocalDayContext(
      params.userId,
      params.clickedAt,
      prismaClient,
    );
    const todaysQuests = await this.loadTodaysQuests(
      params.userId,
      dayContext,
      prismaClient,
    );
    if (todaysQuests.length === 0) {
      return;
    }

    const dailyPracticeQuest = todaysQuests.find(
      (quest) =>
        quest.type === QuestTypeValues.completeDailyPractice &&
        quest.moduleId === params.moduleId &&
        !quest.isCompleted,
    );
    if (dailyPracticeQuest) {
      const completed = await this.completeQuest(
        dailyPracticeQuest,
        params.clickedAt,
        prismaClient,
      );
      if (completed) {
        await this.completeMasterQuestIfEligible(
          params.userId,
          dayContext,
          prismaClient,
        );
      }
      return;
    }

    const streakQuest = todaysQuests.find(
      (quest) =>
        quest.type === QuestTypeValues.dailyPracticeStreak &&
        quest.moduleId === params.moduleId &&
        !quest.isCompleted,
    );
    if (!streakQuest) {
      return;
    }

    const completed = await this.completeQuest(
      streakQuest,
      params.clickedAt,
      prismaClient,
    );
    if (completed) {
      await this.completeMasterQuestIfEligible(
        params.userId,
        dayContext,
        prismaClient,
      );
    }
  }

  // New-unit quest progress should follow module completion events instead of practice-room streak or retry semantics.
  async recordModuleUnitCompletion(
    params: RecordModuleUnitCompletionParams,
    tx?: PrismaClientLike,
  ): Promise<void> {
    const prismaClient = tx ?? this.prisma;
    await this.questGenerationService.ensureQuestDayGeneratedForUser(
      params.userId,
      params.completedAt,
      prismaClient,
    );

    const dayContext = await this.getUserLocalDayContext(
      params.userId,
      params.completedAt,
      prismaClient,
    );
    const todaysQuests = await this.loadTodaysQuests(
      params.userId,
      dayContext,
      prismaClient,
    );
    if (todaysQuests.length === 0) {
      return;
    }

    const completionEvent = await prismaClient.expLedger.findFirst({
      where: {
        userId: params.userId,
        moduleId: params.moduleId,
        eventType: ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
        eventTimestamp: {
          gte: dayContext.dayStartUtc,
          lt: dayContext.nextDayStartUtc,
        },
      },
      select: {
        id: true,
      },
    });
    if (!completionEvent) {
      return;
    }

    const newUnitQuest = todaysQuests.find(
      (quest) =>
        quest.type === QuestTypeValues.completeNewUnit &&
        quest.moduleId === params.moduleId &&
        !quest.isCompleted,
    );
    if (!newUnitQuest) {
      return;
    }

    const completed = await this.completeQuest(
      newUnitQuest,
      params.completedAt,
      prismaClient,
    );
    if (completed) {
      await this.completeMasterQuestIfEligible(
        params.userId,
        dayContext,
        prismaClient,
      );
    }
  }

  // Viewing answers is now informational only; retry quest progress is owned by retry submissions.
  async recordCompletedUnitReview(
    params: RecordCompletedUnitReviewParams,
    tx?: PrismaClientLike,
  ): Promise<void> {
    const prismaClient = tx ?? this.prisma;
    const completedProgress =
      await prismaClient.moduleUnitUserProgress.findUnique({
        where: {
          moduleUnitId_studentId: {
            moduleUnitId: params.moduleUnitId,
            studentId: params.userId,
          },
        },
        select: {
          isCompleted: true,
        },
      });
    if (!completedProgress?.isCompleted) {
      return;
    }
  }

  // Retry quest completion requires distinct correct answers in the current retry session.
  async recordRetrySessionProgress(
    params: RecordRetrySessionProgressParams,
    tx?: PrismaClientLike,
  ): Promise<void> {
    const prismaClient = tx ?? this.prisma;
    await this.questGenerationService.ensureQuestDayGeneratedForUser(
      params.userId,
      params.attemptedAt,
      prismaClient,
    );

    const dayContext = await this.getUserLocalDayContext(
      params.userId,
      params.attemptedAt,
      prismaClient,
    );
    const todaysQuests = await this.loadTodaysQuests(
      params.userId,
      dayContext,
      prismaClient,
    );
    if (todaysQuests.length === 0) {
      return;
    }

    const completedProgress =
      await prismaClient.moduleUnitUserProgress.findUnique({
        where: {
          moduleUnitId_studentId: {
            moduleUnitId: params.moduleUnitId,
            studentId: params.userId,
          },
        },
        select: {
          isCompleted: true,
        },
      });
    if (!completedProgress?.isCompleted) {
      return;
    }

    const retryQuest = todaysQuests.find(
      (quest) =>
        quest.type === QuestTypeValues.moduleUnitRetry &&
        quest.moduleId === params.moduleId &&
        !quest.isCompleted,
    );
    if (!retryQuest) {
      return;
    }

    const totalQuestions = await prismaClient.questionUnit.count({
      where: {
        moduleUnitId: params.moduleUnitId,
        isArchived: false,
        contents: {
          some: {
            isCore: true,
            isArchived: false,
          },
        },
      },
    });
    if (totalQuestions <= 0) {
      return;
    }

    const requiredCorrectAnswers = Math.ceil(totalQuestions * 0.7);
    const correctRetryAttempts = await prismaClient.questionAttempt.findMany({
      where: {
        moduleUnitId: params.moduleUnitId,
        studentId: params.userId,
        sessionId: params.sessionId,
        isCorrect: true,
      },
      select: {
        questionId: true,
      },
      distinct: ['questionId'],
    });
    if (correctRetryAttempts.length < requiredCorrectAnswers) {
      return;
    }

    const completed = await this.completeQuest(
      retryQuest,
      params.attemptedAt,
      prismaClient,
    );
    if (completed) {
      await this.completeMasterQuestIfEligible(
        params.userId,
        dayContext,
        prismaClient,
      );
    }
  }

  // Daily-practice quests are set-scoped, so progress is derived from today's persisted set and that set's first-attempt timeline.
  async recordDailyPracticeSetProgress(
    params: RecordDailyPracticeSetProgressParams,
    tx?: PrismaClientLike,
  ): Promise<void> {
    const prismaClient = tx ?? this.prisma;
    await this.questGenerationService.ensureQuestDayGeneratedForUser(
      params.userId,
      params.progressedAt,
      prismaClient,
    );

    const dayContext = await this.getUserLocalDayContext(
      params.userId,
      params.progressedAt,
      prismaClient,
    );
    const todaysQuests = await this.loadTodaysQuests(
      params.userId,
      dayContext,
      prismaClient,
    );
    if (todaysQuests.length === 0) {
      return;
    }

    const todaysSet = await prismaClient.dailyPracticeSet.findUnique({
      where: {
        userId_moduleId_practiceDateUtc: {
          userId: params.userId,
          moduleId: params.moduleId,
          practiceDateUtc: dayContext.dayStartDb,
        },
      },
      select: {
        completedAt: true,
        items: {
          select: {
            questionUnitId: true,
          },
        },
      },
    });
    if (!todaysSet || todaysSet.items.length === 0) {
      return;
    }

    let completedAnyQuest = false;

    const completionQuest = todaysQuests.find(
      (quest) =>
        quest.type === QuestTypeValues.completeDailyPractice &&
        quest.moduleId === params.moduleId &&
        !quest.isCompleted,
    );
    if (completionQuest && todaysSet.completedAt) {
      completedAnyQuest =
        (await this.completeQuest(
          completionQuest,
          params.progressedAt,
          prismaClient,
        )) || completedAnyQuest;
    }

    const streakQuest = todaysQuests.find(
      (quest) =>
        quest.type === QuestTypeValues.dailyPracticeStreak &&
        quest.moduleId === params.moduleId &&
        !quest.isCompleted,
    );
    if (streakQuest) {
      const firstAttempts = await prismaClient.questionAttempt.findMany({
        where: {
          studentId: params.userId,
          questionId: {
            in: todaysSet.items.map((item) => item.questionUnitId),
          },
          attemptedAt: {
            gte: dayContext.dayStartUtc,
            lt: dayContext.nextDayStartUtc,
          },
          session: {
            moduleId: params.moduleId,
            userId: params.userId,
            sessionType: PracticeSessionTypeValues.dailyPractice,
          },
        },
        orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
        select: {
          questionId: true,
          isCorrect: true,
          hintsUsed: true,
        },
      });

      if (
        this.hasReachedDailyPracticeStreak(
          firstAttempts,
          getQuestDefinition(QuestTypeValues.dailyPracticeStreak)
            .defaultProgressTarget,
        )
      ) {
        completedAnyQuest =
          (await this.completeQuest(
            streakQuest,
            params.progressedAt,
            prismaClient,
          )) || completedAnyQuest;
      }
    }

    if (completedAnyQuest) {
      await this.completeMasterQuestIfEligible(
        params.userId,
        dayContext,
        prismaClient,
      );
    }
  }

  private async loadTodaysQuests(
    userId: number,
    dayContext: UserLocalDayContext,
    prismaClient: PrismaClientLike,
  ): Promise<PersistedQuest[]> {
    const quests = await prismaClient.dailyQuest.findMany({
      where: {
        userId,
        questDateUtc: dayContext.dayStartDb,
      },
      orderBy: {
        id: 'asc',
      },
    });

    // Prisma persists quest type as string, but quest logic should operate against the shared union for safety.
    return quests.map((quest) => ({
      ...quest,
      type: quest.type as QuestType,
    }));
  }

  private async completeMasterQuestIfEligible(
    userId: number,
    dayContext: UserLocalDayContext,
    prismaClient: PrismaClientLike,
  ): Promise<void> {
    const todaysQuests = await this.loadTodaysQuests(
      userId,
      dayContext,
      prismaClient,
    );
    const dailyQuestCount = todaysQuests.filter(
      (quest) => quest.type !== QuestTypeValues.masterDailyQuests,
    ).length;
    const completedDailyQuestCount = todaysQuests.filter(
      (quest) =>
        quest.type !== QuestTypeValues.masterDailyQuests && quest.isCompleted,
    ).length;
    if (dailyQuestCount === 0 || completedDailyQuestCount < dailyQuestCount) {
      return;
    }

    const masterQuest = todaysQuests.find(
      (quest) =>
        quest.type === QuestTypeValues.masterDailyQuests && !quest.isCompleted,
    );
    if (!masterQuest) {
      return;
    }

    const rewardState =
      await this.questStreakService.getRewardForNextMasterQuestCompletion(
        userId,
        dayContext.timestamp,
        prismaClient,
      );
    const missingDailyQuestCount = Math.max(
      0,
      MAX_DAILY_QUEST_COUNT - dailyQuestCount,
    );
    await this.completeQuest(
      masterQuest,
      dayContext.timestamp,
      prismaClient,
      rewardState.awardedExp + missingDailyQuestCount * QUEST_COMPLETION_REWARD,
    );
  }

  private async getUserLocalDayContext(
    userId: number,
    timestamp: Date,
    prismaClient: PrismaClientLike,
  ): Promise<UserLocalDayContext> {
    const userRecord = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const timezone = userRecord?.timezone ?? 'UTC';
    const localDateKey = DateHelpers.getLocalDateKey(timestamp, timezone);
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      timestamp,
      timezone,
    );

    return {
      timestamp,
      dayStartDb: new Date(`${localDateKey}T00:00:00.000Z`),
      dayStartUtc,
      nextDayStartUtc,
    };
  }

  private async completeQuest(
    quest: PersistedQuest,
    completedAt: Date,
    prismaClient: PrismaClientLike,
    awardedExpOverride?: number,
  ): Promise<boolean> {
    const awardedExp = awardedExpOverride ?? quest.expGranted;
    if (quest.isCompleted) {
      return false;
    }

    // A quest cannot be satisfied by work that finished before it existed; otherwise
    // mid-day generation top-ups would auto-complete from prior activity (e.g. a
    // newly enrolled module's first lesson completed before the lesson quest was
    // created).
    if (completedAt < quest.generatedAt) {
      return false;
    }

    // Completion always targets one known quest row
    await prismaClient.dailyQuest.update({
      where: {
        id: quest.id,
      },
      data: {
        // The quest row keeps the generated base reward while the ledger owns the actual awarded amount.
        isCompleted: true,
        completedAt,
      },
    });

    const rewardEvent = await this.expLedgerService.recordEvent(
      {
        userId: quest.userId,
        moduleId: quest.moduleId,
        moduleUnitId: quest.moduleUnitId,
        sessionId: null,
        questId: quest.id,
        eventType: ExpLedgerEventTypes.COMPLETE_QUEST,
        awardedExp,
        idempotencyKey: `quest_completion:quest:${quest.id}`,
      },
      prismaClient,
    );
    if (rewardEvent.created && rewardEvent.awardedExp > 0) {
      await this.avatarService.addStudentExp(
        quest.userId,
        rewardEvent.awardedExp,
        prismaClient,
      );
    }

    return true;
  }

  private hasReachedDailyPracticeStreak(
    attempts: Array<{
      questionId: number;
      isCorrect: boolean;
      hintsUsed: number;
    }>,
    targetStreak: number,
  ): boolean {
    const attemptedQuestionIds = new Set<number>();
    let currentStreak = 0;

    for (const attempt of attempts) {
      if (attemptedQuestionIds.has(attempt.questionId)) {
        continue;
      }
      attemptedQuestionIds.add(attempt.questionId);

      if (attempt.isCorrect && attempt.hintsUsed === 0) {
        currentStreak += 1;
      } else {
        currentStreak = 0;
      }

      if (currentStreak >= targetStreak) {
        return true;
      }
    }

    return false;
  }
}
