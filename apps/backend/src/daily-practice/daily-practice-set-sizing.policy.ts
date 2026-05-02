// Role: centralizes daily-practice set sizing rules so product tuning can happen without rewriting selector bucket logic.
import type {
  DailyPracticeSelectionInventory,
  DailyPracticeSelectionPlan,
} from './daily-practice.types';

export const MIN_DAILY_PRACTICE_QUESTION_COUNT = 3; // Minimum viable set size to maintain the "daily practice" experience.
export const MAX_DAILY_PRACTICE_QUESTION_COUNT = 10; // Cap on set size to maintain a consistent experience and avoid overwhelming learners.
export const DAILY_PRACTICE_REVIEW_RATIO = 0.4; // Proportion of review-eligible questions to include in a set (e.g. if 10 question are eligible for review, the set will be 3 questions)
export const REINFORCEMENT_RATIO = 0.3;

// Guards against generating a set when the module has too few eligible questions to be a meaningful practice session.
export function hasMinimumEligibleInventory(
  inventory: DailyPracticeSelectionInventory,
): boolean {
  return (
    getTotalEligibleQuestionCount(inventory) >=
    MIN_DAILY_PRACTICE_QUESTION_COUNT
  );
}

// Derives quota allocations for each bucket from current inventory. Returns a zero-plan when inventory is below the minimum threshold.
export function buildDailyPracticeSelectionPlan(
  inventory: DailyPracticeSelectionInventory,
  requestedTargetQuestionCount?: number,
): DailyPracticeSelectionPlan {
  if (!hasMinimumEligibleInventory(inventory)) {
    // A zero-plan keeps "no set today" explicit and avoids pretending a valid target exists when inventory is too small.
    return {
      targetQuestionCount: 0,
      dueReviewQuota: 0,
      reinforcementQuota: 0,
    };
  }

  const targetQuestionCount = deriveDailyPracticeTargetQuestionCount(
    inventory,
    requestedTargetQuestionCount,
  );
  // Floor keeps the reinforcement slice stable for the current 3-6 range while still scaling upward if the max expands later.
  const reinforcementQuota = Math.max(
    1,
    Math.floor(targetQuestionCount * REINFORCEMENT_RATIO),
  );
  const dueReviewQuota = targetQuestionCount - reinforcementQuota;

  return {
    targetQuestionCount,
    dueReviewQuota,
    reinforcementQuota,
  };
}

// Scales set size proportionally to eligible inventory, always clamped between MIN and MAX. A caller-supplied override bypasses proportional sizing and only applies the clamp.
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
  return inventory.dueReviewCount + inventory.reinforcementCount;
}
