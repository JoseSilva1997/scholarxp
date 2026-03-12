// Service role: encapsulates calculation and rules for XP rewards to simplify orchestration logic.
import { Injectable } from '@nestjs/common';
import {
  MODULE_UNIT_COMPLETION_REWARDS,
  MODULE_UNIT_BASELINE_EXP,
  MAXIMUM_FIRST_ATTEMPT_BONUS_EXP,
} from '@scholarxp/constants';

@Injectable()
export class ExpCalculationService {
  resolveDailyCompletionReward(completionCountToday: number): number {
    // First completion of the UTC day gets full reward.
    if (completionCountToday <= 0) {
      return MODULE_UNIT_COMPLETION_REWARDS.FIRST_COMPLETION;
    }
    // Second completion gets reduced reward.
    if (completionCountToday === 1) {
      return MODULE_UNIT_COMPLETION_REWARDS.SECOND_COMPLETION;
    }
    return MODULE_UNIT_COMPLETION_REWARDS.SUBSEQUENT_COMPLETIONS;
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
      totalPoolExp: MODULE_UNIT_BASELINE_EXP,
      totalQuestions,
      isLastQuestion,
    });
  }

  getFirstAttemptBonusAward(
    totalQuestions: number,
    isLastQuestion: boolean,
  ): number {
    return this.getPerQuestionAward({
      totalPoolExp: MAXIMUM_FIRST_ATTEMPT_BONUS_EXP,
      totalQuestions,
      isLastQuestion,
    });
  }

  resolveReachedStreakTier(
    highestStreak: number,
    totalQuestions: number,
  ): number {
    // Units with fewer than 4 questions are too short to have a meaningful streak
    // mechanic; suppressing the bonus here keeps incentives fair across unit sizes.
    if (totalQuestions < 4) {
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
