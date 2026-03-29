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

  // Header reads should reflect the effective streak as of "now", including reset-to-zero after a missed local day.
  async getCurrentStreakStatus(
    userId: number,
    timestamp: Date = new Date(),
    tx?: PrismaClientLike,
  ): Promise<MasterQuestStreakResponse> {
    const prismaClient = tx ?? this.prisma;

    const userRecord = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const timezone = userRecord?.timezone ?? 'UTC';

    // The @db.Date column stores the local calendar date (YYYY-MM-DD) — compare against that key, not the UTC instant.
    const todayLocalKey = DateHelpers.getLocalDateKey(timestamp, timezone);
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getLocalDayBounds(
      timestamp,
      timezone,
    );
    // 1 ms before local midnight = end of the previous local day, giving us yesterday's date key.
    const yesterdayLocalKey = DateHelpers.getLocalDateKey(
      new Date(dayStartUtc.getTime() - 1),
      timezone,
    );

    const recentQuestDays = await this.loadRecentCompletedMasterQuestDays(
      userId,
      nextDayStartUtc,
      prismaClient,
    );
    const lastCompletedQuestDay = recentQuestDays[0] ?? null;
    if (!lastCompletedQuestDay) {
      return this.buildStatus(0, null);
    }

    // DB dates are local calendar dates stored at UTC midnight — slice(0,10) gives the YYYY-MM-DD key.
    const lastKey = lastCompletedQuestDay.toISOString().slice(0, 10);

    // anchorDayDbDate is the DB-comparable midnight date for the streak anchor (today or yesterday).
    const anchorDayDbDate =
      lastKey === todayLocalKey
        ? new Date(`${todayLocalKey}T00:00:00.000Z`)
        : lastKey === yesterdayLocalKey
          ? new Date(`${yesterdayLocalKey}T00:00:00.000Z`)
          : null;

    if (!anchorDayDbDate) {
      return this.buildStatus(0, lastKey);
    }

    const currentStreak = this.countConsecutiveQuestDays(
      recentQuestDays,
      anchorDayDbDate,
    );

    return this.buildStatus(currentStreak, lastKey);
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
    // Product rule: today's reward is based on the streak value before today's completion,
    // then the completion increments the streak for the next day.
    const streakCount = Math.min(
      currentStatus.currentStreak,
      MASTER_QUEST_STREAK_MAX,
    );
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
    nextDayStartUtc: Date,
    prismaClient: PrismaClientLike,
  ): Promise<Date[]> {
    const rows = await prismaClient.dailyQuest.findMany({
      where: {
        userId,
        type: QuestTypeValues.masterDailyQuests,
        isCompleted: true,
        questDateUtc: {
          lt: nextDayStartUtc,
        },
      },
      orderBy: [{ questDateUtc: 'desc' }, { id: 'desc' }],
      select: {
        questDateUtc: true,
      },
      // The streak is capped, so there is no value in loading a longer history for this read.
      take: MASTER_QUEST_STREAK_MAX,
    });

    // Normalize DB dates to UTC day starts before streak comparison so date-column parsing quirks cannot zero the streak.
    return rows.map(
      (row) => DateHelpers.getUtcDayBounds(row.questDateUtc).dayStartUtc,
    );
  }

  private countConsecutiveQuestDays(
    recentQuestDays: Date[],
    anchorDayUtc: Date,
  ): number {
    let streakCount = 0;
    let expectedQuestDayMs = anchorDayUtc.getTime();

    for (const questDay of recentQuestDays) {
      const normalizedQuestDayMs =
        DateHelpers.getUtcDayBounds(questDay).dayStartUtc.getTime();
      if (normalizedQuestDayMs !== expectedQuestDayMs) {
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
