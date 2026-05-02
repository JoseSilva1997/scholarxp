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
    const { dayStartUtc } = DateHelpers.getLocalDayBounds(timestamp, timezone);
    // 1 ms before local midnight = end of the previous local day, giving us yesterday's date key.
    const yesterdayLocalKey = DateHelpers.getLocalDateKey(
      new Date(dayStartUtc.getTime() - 1),
      timezone,
    );

    const recentQuestDayKeys = await this.loadRecentCompletedMasterQuestDayKeys(
      userId,
      this.toDbDay(todayLocalKey),
      prismaClient,
    );
    const lastCompletedQuestDayKey = recentQuestDayKeys[0] ?? null;
    if (!lastCompletedQuestDayKey) {
      return this.buildStatus(0, null);
    }

    const anchorDayDbDate =
      lastCompletedQuestDayKey === todayLocalKey
        ? new Date(`${todayLocalKey}T00:00:00.000Z`)
        : lastCompletedQuestDayKey === yesterdayLocalKey
          ? new Date(`${yesterdayLocalKey}T00:00:00.000Z`)
          : null;

    if (!anchorDayDbDate) {
      return this.buildStatus(0, lastCompletedQuestDayKey);
    }

    const currentStreak = this.countConsecutiveQuestDays(
      recentQuestDayKeys,
      anchorDayDbDate,
    );

    return this.buildStatus(currentStreak, lastCompletedQuestDayKey);
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

  private async loadRecentCompletedMasterQuestDayKeys(
    userId: number,
    latestVisibleQuestDayDb: Date,
    prismaClient: PrismaClientLike,
  ): Promise<string[]> {
    const rows = await prismaClient.dailyQuest.findMany({
      where: {
        userId,
        type: QuestTypeValues.masterDailyQuests,
        isCompleted: true,
        questDateUtc: {
          lte: latestVisibleQuestDayDb,
        },
      },
      orderBy: [{ questDateUtc: 'desc' }, { id: 'desc' }],
      select: {
        questDateUtc: true,
      },
      // The streak is capped, so there is no value in loading a longer history for this read.
      take: MASTER_QUEST_STREAK_MAX,
    });

    // Convert persisted @db.Date values back into YYYY-MM-DD keys so streak comparison never depends on DateTime casting.
    return rows.map((row) => row.questDateUtc.toISOString().slice(0, 10));
  }

  // Walks backwards day-by-day from the anchor date, counting how many consecutive completed master quest days exist.
  // The loop terminates as soon as a gap in the sequence is found or the streak cap is reached.
  private countConsecutiveQuestDays(
    recentQuestDayKeys: string[],
    anchorDayUtc: Date,
  ): number {
    let streakCount = 0;
    let expectedQuestDayKey = anchorDayUtc.toISOString().slice(0, 10);

    for (const questDayKey of recentQuestDayKeys) {
      if (questDayKey !== expectedQuestDayKey) {
        break;
      }

      streakCount += 1;
      if (streakCount >= MASTER_QUEST_STREAK_MAX) {
        break;
      }

      expectedQuestDayKey = this.shiftDayKey(expectedQuestDayKey, -1);
    }

    return streakCount;
  }

  // Assembles the streak response DTO, deriving the bonus percent from the streak count rather than storing it separately.
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

  // Converts a YYYY-MM-DD key to the UTC midnight Date value used by the @db.Date Prisma column.
  private toDbDay(dayKey: string): Date {
    return new Date(`${dayKey}T00:00:00.000Z`);
  }

  // Shifts a YYYY-MM-DD key by dayDelta calendar days using UTC date arithmetic to avoid DST drift.
  private shiftDayKey(dayKey: string, dayDelta: number): string {
    const shiftedDay = this.toDbDay(dayKey);
    shiftedDay.setUTCDate(shiftedDay.getUTCDate() + dayDelta);
    return shiftedDay.toISOString().slice(0, 10);
  }
}
