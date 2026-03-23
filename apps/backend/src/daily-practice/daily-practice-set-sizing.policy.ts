// Role: centralizes daily-practice set sizing rules so product tuning can happen without rewriting selector bucket logic.
import type {
  DailyPracticeSelectionInventory,
  DailyPracticeSelectionPlan,
} from './daily-practice.types';

export const MIN_DAILY_PRACTICE_QUESTION_COUNT = 3;
export const MAX_DAILY_PRACTICE_QUESTION_COUNT = 6;
export const DAILY_PRACTICE_REVIEW_RATIO = 0.25;
export const REINFORCEMENT_RATIO = 0.2;
export const NEW_SEQUENCE_MIN_TARGET = 4;

export function hasMinimumEligibleInventory(
  inventory: DailyPracticeSelectionInventory,
): boolean {
  // Eligibility uses total inventory, including new-sequence, because fallback rules may still form a valid set even when review pressure is low.
  // Set sizing intentionally excludes new-sequence so lesson progression does not inflate the number of questions served for the day.
  return (
    getTotalEligibleQuestionCount(inventory) >=
    MIN_DAILY_PRACTICE_QUESTION_COUNT
  );
}

export function buildDailyPracticeSelectionPlan(
  inventory: DailyPracticeSelectionInventory,
  requestedTargetQuestionCount?: number,
): DailyPracticeSelectionPlan {
  if (!hasMinimumEligibleInventory(inventory)) {
    // A zero-plan keeps "no set today" explicit and avoids pretending a valid target exists when inventory is too small.
    return {
      targetQuestionCount: 0,
      dueReviewQuota: 0,
      newSequenceQuota: 0,
      reinforcementQuota: 0,
    };
  }

  const targetQuestionCount = deriveDailyPracticeTargetQuestionCount(
    inventory,
    requestedTargetQuestionCount,
  );
  // A single forward-motion slot keeps new content secondary to review pressure while still allowing gentle progression on larger sets.
  const newSequenceQuota =
    targetQuestionCount >= NEW_SEQUENCE_MIN_TARGET ? 1 : 0;
  // Floor keeps the reinforcement slice stable for the current 3-6 range while still scaling upward if the max expands later.
  const reinforcementQuota = Math.max(
    1,
    Math.floor(targetQuestionCount * REINFORCEMENT_RATIO),
  );
  const dueReviewQuota =
    targetQuestionCount - reinforcementQuota - newSequenceQuota;

  return {
    targetQuestionCount,
    dueReviewQuota,
    newSequenceQuota,
    reinforcementQuota,
  };
}

export function deriveDailyPracticeTargetQuestionCount(
  inventory: DailyPracticeSelectionInventory,
  requestedTargetQuestionCount?: number,
): number {
  if (requestedTargetQuestionCount !== undefined) {
    return clampDailyPracticeTargetQuestionCount(requestedTargetQuestionCount);
  }

  const reviewEligibleCount =
    inventory.dueReviewCount + inventory.reinforcementCount;
  const proportional = Math.round(
    reviewEligibleCount * DAILY_PRACTICE_REVIEW_RATIO,
  );

  return clampDailyPracticeTargetQuestionCount(
    Math.max(MIN_DAILY_PRACTICE_QUESTION_COUNT, proportional),
  );
}

function clampDailyPracticeTargetQuestionCount(
  targetQuestionCount: number,
): number {
  return Math.min(
    MAX_DAILY_PRACTICE_QUESTION_COUNT,
    Math.max(MIN_DAILY_PRACTICE_QUESTION_COUNT, targetQuestionCount),
  );
}

function getTotalEligibleQuestionCount(
  inventory: DailyPracticeSelectionInventory,
): number {
  return (
    inventory.dueReviewCount +
    inventory.reinforcementCount +
    inventory.newSequenceCount
  );
}
