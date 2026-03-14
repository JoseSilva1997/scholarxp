// DTO keeps the master-quest streak read endpoint compile-time aligned with the shared quests contract.
import type { MasterQuestStreakResponse } from '@scholarxp/api-contracts';
import {
  MASTER_QUEST_STREAK_MAX,
  MASTER_QUEST_STREAK_PERCENT_PER_STEP,
} from '@scholarxp/constants';

export class MasterQuestStreakResponseDto implements MasterQuestStreakResponse {
  currentStreak!: number;
  maxStreak: typeof MASTER_QUEST_STREAK_MAX = MASTER_QUEST_STREAK_MAX;
  bonusPercent!: number;
  bonusPercentPerStep: typeof MASTER_QUEST_STREAK_PERCENT_PER_STEP =
    MASTER_QUEST_STREAK_PERCENT_PER_STEP;
  lastCompletedQuestDateUtc!: string | null;
}
