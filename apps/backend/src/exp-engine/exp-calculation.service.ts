// Service role: encapsulates calculation and rules for XP rewards to simplify orchestration logic and enable dedicated unit testing.
import { Injectable } from '@nestjs/common';

const FIRST_COMPLETION_REWARD = 100;
const SECOND_COMPLETION_REWARD = 25;
const MODULE_BASELINE_EXP = 1000;
const FIRST_ATTEMPT_BONUS_EXP = 150;
export const STREAK_TIER_DELTA_EXP = 50;

@Injectable()
export class ExpCalculationService {
  resolveDailyCompletionReward(completionCountToday: number): number {
    // First completion of the UTC day gets full reward.
    if (completionCountToday <= 0) {
      return FIRST_COMPLETION_REWARD;
    }
    // Second completion gets reduced reward.
    if (completionCountToday === 1) {
      return SECOND_COMPLETION_REWARD;
    }
    // Third and beyond intentionally grant zero.
    return 0;
  }

  // Question-level pools are floored and remaining XP is allocated to the last question.
  getPerQuestionAward(input: {
    totalPoolExp: number;
    totalQuestions: number;
    isLastQuestion: boolean;
  }): number {
    // Guard against invalid question totals to avoid division issues.
    if (input.totalQuestions <= 0) {
      return 0;
    }
    // Use floored share for deterministic integer rewards per question.
    const baseShare = Math.floor(input.totalPoolExp / input.totalQuestions);
    // Preserve full pool sum by assigning remainder to the last question.
    const remainder = input.totalPoolExp - baseShare * input.totalQuestions;
    return input.isLastQuestion ? baseShare + remainder : baseShare;
  }

  getBaselineAward(totalQuestions: number, isLastQuestion: boolean): number {
    return this.getPerQuestionAward({
      totalPoolExp: MODULE_BASELINE_EXP,
      totalQuestions,
      isLastQuestion,
    });
  }

  getFirstAttemptBonusAward(
    totalQuestions: number,
    isLastQuestion: boolean,
  ): number {
    return this.getPerQuestionAward({
      totalPoolExp: FIRST_ATTEMPT_BONUS_EXP,
      totalQuestions,
      isLastQuestion,
    });
  }

  resolveReachedStreakTier(
    highestStreak: number,
    totalQuestions: number,
  ): number {
    // Streak rewards only start at 3 correct answers by policy.
    if (totalQuestions <= 0 || highestStreak < 3) {
      return 0;
    }
    // Percent thresholds scale with lesson size and clamp to minimum streak size.
    const tierOneThreshold = Math.max(3, Math.ceil(totalQuestions * 0.3));
    const tierTwoThreshold = Math.max(3, Math.ceil(totalQuestions * 0.5));
    const tierThreeThreshold = Math.max(3, totalQuestions);

    // Return highest achieved tier; caller awards tier deltas up to this value.
    if (highestStreak >= tierThreeThreshold) {
      return 3;
    }
    if (highestStreak >= tierTwoThreshold) {
      return 2;
    }
    if (highestStreak >= tierOneThreshold) {
      return 1;
    }
    return 0;
  }
}
