// Service role: encapsulates calculation and rules for XP rewards to simplify orchestration logic.
import { Injectable } from '@nestjs/common';
import {
  MODULE_UNIT_COMPLETION_REWARDS,
  MODULE_UNIT_BASELINE_EXP,
  MAXIMUM_FIRST_ATTEMPT_BONUS_EXP,
} from '@scholarxp/constants';

@Injectable()
export class ExpCalculationService {
  // Maps the number of lessons completed today to the account XP reward for the next completion.
  // Implements the diminishing-returns schedule (100 / 25 / 0) defined in exp-rules.ts to
  // cap daily account XP gain across students with high lesson volume.
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

  // Divides a fixed XP pool evenly across questions using integer arithmetic.
  // Floor division ensures each question receives a deterministic whole-number award;
  // the remainder is collapsed onto the last question so the pool always sums exactly.
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

  // Returns the baseline module XP for a single correct answer, drawn from the 1000 XP pool.
  getBaselineAward(totalQuestions: number, isLastQuestion: boolean): number {
    return this.getPerQuestionAward({
      totalPoolExp: MODULE_UNIT_BASELINE_EXP,
      totalQuestions,
      isLastQuestion,
    });
  }

  // Returns the first-attempt bonus XP for one question, drawn from the 150 XP bonus pool.
  // Only called when the learner answered correctly on their very first attempt without hint assistance.
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

  // Determines the highest streak tier (0–3) reached during a session.
  // Thresholds are percentage-based and scale with lesson size so the bar is proportionally
  // consistent regardless of how many questions a unit contains.
  // Returns the tier index rather than an XP value; the caller computes cumulative delta awards.
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
