// Role: derives master-quest streak status from canonical completed quests so no parallel streak table is needed.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { MasterQuestStreakResponse } from '@scholarxp/api-contracts';
import { QuestTypeValues } from '@scholarxp/api-contracts';
import {
  MASTER_QUEST_COMPLETION_REWARD,
  MASTER_QUEST_STREAK_MAX,
  MASTER_QUEST_STREAK_PERCENT_PER_STEP,
} from '@scholarxp/constants';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

type MasterQuestRewardState = {
  awardedExp: number;
  bonusPercent: number;
  streakCount: number;
};

const UTC_DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class QuestStreakService {
  constructor(private readonly prisma: PrismaService) {}

  // Header reads should reflect the effective streak as of "now", including reset-to-zero after a missed UTC day.
  async getCurrentStreakStatus(
    userId: number,
    timestamp: Date = new Date(),
    tx?: PrismaClientLike,
  ): Promise<MasterQuestStreakResponse> {
    const prismaClient = tx ?? this.prisma;
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(timestamp);
    const recentQuestDays = await this.loadRecentCompletedMasterQuestDays(
      userId,
      dayStartUtc,
      prismaClient,
    );
    const lastCompletedQuestDay = recentQuestDays[0] ?? null;
    const lastCompletedQuestDateUtc = lastCompletedQuestDay
      ? this.toUtcDayKey(lastCompletedQuestDay)
      : null;
    if (!lastCompletedQuestDay) {
      return this.buildStatus(0, null);
    }

    const yesterdayStartUtc = new Date(dayStartUtc.getTime() - UTC_DAY_IN_MS);
    const anchorDayUtc =
      lastCompletedQuestDay.getTime() === dayStartUtc.getTime()
        ? dayStartUtc
        : lastCompletedQuestDay.getTime() === yesterdayStartUtc.getTime()
          ? yesterdayStartUtc
          : null;
    if (!anchorDayUtc) {
      return this.buildStatus(0, lastCompletedQuestDateUtc);
    }

    const currentStreak = this.countConsecutiveQuestDays(
      recentQuestDays,
      anchorDayUtc,
    );

    return this.buildStatus(currentStreak, lastCompletedQuestDateUtc);
  }

  // Reward calculation is backend-owned so the awarded EXP stays consistent across retries and future clients.
  async getRewardForNextMasterQuestCompletion(
    userId: number,
    completedAt: Date,
    tx?: PrismaClientLike,
  ): Promise<MasterQuestRewardState> {
    const currentStatus = await this.getCurrentStreakStatus(
      userId,
      completedAt,
      tx,
    );
    const todayQuestDateUtc = this.toUtcDayKey(
      DateHelpers.getUtcDayBounds(completedAt).dayStartUtc,
    );
    const alreadyCompletedToday =
      currentStatus.lastCompletedQuestDateUtc === todayQuestDateUtc;
    const streakCount = alreadyCompletedToday
      ? currentStatus.currentStreak
      : Math.min(currentStatus.currentStreak + 1, MASTER_QUEST_STREAK_MAX);
    const bonusPercent = streakCount * MASTER_QUEST_STREAK_PERCENT_PER_STEP;

    return {
      streakCount,
      bonusPercent,
      awardedExp: Math.round(
        MASTER_QUEST_COMPLETION_REWARD * (1 + bonusPercent / 100),
      ),
    };
  }

  private async loadRecentCompletedMasterQuestDays(
    userId: number,
    dayStartUtc: Date,
    prismaClient: PrismaClientLike,
  ): Promise<Date[]> {
    const rows = await prismaClient.dailyQuest.findMany({
      where: {
        userId,
        type: QuestTypeValues.masterDailyQuests,
        isCompleted: true,
        questDateUtc: {
          lte: dayStartUtc,
        },
      },
      orderBy: [{ questDateUtc: 'desc' }, { id: 'desc' }],
      select: {
        questDateUtc: true,
      },
      // The streak is capped, so there is no value in loading a longer history for this read.
      take: MASTER_QUEST_STREAK_MAX,
    });

    return rows.map((row) => row.questDateUtc);
  }

  private countConsecutiveQuestDays(
    recentQuestDays: Date[],
    anchorDayUtc: Date,
  ): number {
    let streakCount = 0;
    let expectedQuestDayMs = anchorDayUtc.getTime();

    for (const questDay of recentQuestDays) {
      if (questDay.getTime() !== expectedQuestDayMs) {
        break;
      }

      streakCount += 1;
      if (streakCount >= MASTER_QUEST_STREAK_MAX) {
        break;
      }

      expectedQuestDayMs -= UTC_DAY_IN_MS;
    }

    return streakCount;
  }

  private buildStatus(
    currentStreak: number,
    lastCompletedQuestDateUtc: string | null,
  ): MasterQuestStreakResponse {
    return {
      currentStreak,
      maxStreak: MASTER_QUEST_STREAK_MAX,
      bonusPercent: currentStreak * MASTER_QUEST_STREAK_PERCENT_PER_STEP,
      bonusPercentPerStep: MASTER_QUEST_STREAK_PERCENT_PER_STEP,
      lastCompletedQuestDateUtc,
    };
  }

  private toUtcDayKey(dayUtc: Date): string {
    return dayUtc.toISOString().slice(0, 10);
  }
}
