// Role: owns quest completion events so future UI triggers can stay thin and backend rules remain centralized.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { QuestTypeValues, type QuestType } from '@scholarxp/api-contracts';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { QuestGenerationService } from './quest-generation.service';

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

    const todaysQuests = await this.loadTodaysQuests(
      params.userId,
      params.clickedAt,
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
          params.clickedAt,
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
        params.clickedAt,
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

    const todaysQuests = await this.loadTodaysQuests(
      params.userId,
      params.completedAt,
      prismaClient,
    );
    if (todaysQuests.length === 0) {
      return;
    }

    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getUtcDayBounds(
      params.completedAt,
    );
    const completionEvent = await prismaClient.expLedger.findFirst({
      where: {
        userId: params.userId,
        moduleId: params.moduleId,
        eventType: ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
        eventTimestamp: {
          gte: dayStartUtc,
          lt: nextDayStartUtc,
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
        params.completedAt,
        prismaClient,
      );
    }
  }

  // Viewing answers on an already completed lesson is the planned retry trigger until retry mode exists.
  async recordCompletedUnitReview(
    params: RecordCompletedUnitReviewParams,
    tx?: PrismaClientLike,
  ): Promise<void> {
    const prismaClient = tx ?? this.prisma;
    await this.questGenerationService.ensureQuestDayGeneratedForUser(
      params.userId,
      params.viewedAt,
      prismaClient,
    );

    const todaysQuests = await this.loadTodaysQuests(
      params.userId,
      params.viewedAt,
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

    const completed = await this.completeQuest(
      retryQuest,
      params.viewedAt,
      prismaClient,
    );
    if (completed) {
      await this.completeMasterQuestIfEligible(
        params.userId,
        params.viewedAt,
        prismaClient,
      );
    }
  }

  private async loadTodaysQuests(
    userId: number,
    timestamp: Date,
    prismaClient: PrismaClientLike,
  ): Promise<PersistedQuest[]> {
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(timestamp);
    const quests = await prismaClient.dailyQuest.findMany({
      where: {
        userId,
        questDateUtc: dayStartUtc,
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
    timestamp: Date,
    prismaClient: PrismaClientLike,
  ): Promise<void> {
    const todaysQuests = await this.loadTodaysQuests(
      userId,
      timestamp,
      prismaClient,
    );
    const completedDailyQuestCount = todaysQuests.filter(
      (quest) =>
        quest.type !== QuestTypeValues.masterDailyQuests && quest.isCompleted,
    ).length;
    if (completedDailyQuestCount < 3) {
      return;
    }

    const masterQuest = todaysQuests.find(
      (quest) =>
        quest.type === QuestTypeValues.masterDailyQuests && !quest.isCompleted,
    );
    if (!masterQuest) {
      return;
    }

    await this.completeQuest(masterQuest, timestamp, prismaClient);
  }

  private async completeQuest(
    quest: PersistedQuest,
    completedAt: Date,
    prismaClient: PrismaClientLike,
  ): Promise<boolean> {
    const updateResult = await prismaClient.dailyQuest.updateMany({
      where: {
        id: quest.id,
        isCompleted: false,
      },
      data: {
        isCompleted: true,
        completedAt,
      },
    });
    if (updateResult.count === 0) {
      return false;
    }

    const rewardEvent = await this.expLedgerService.recordEvent(
      {
        userId: quest.userId,
        moduleId: quest.moduleId,
        moduleUnitId: quest.moduleUnitId,
        sessionId: null,
        questId: quest.id,
        eventType: ExpLedgerEventTypes.COMPLETE_QUEST,
        awardedExp: quest.expGranted,
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
}
