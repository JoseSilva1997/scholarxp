// Role: verifies daily-practice sizing stays review-driven and clamped so selector tuning remains safe to change later.
import {
  buildDailyPracticeSelectionPlan,
  deriveDailyPracticeTargetQuestionCount,
} from './daily-practice-set-sizing.policy';
import type { DailyPracticeSelectionInventory } from './daily-practice.types';

describe('daily-practice set sizing policy', () => {
  it('derives target size from review burden and clamps it to the configured floor', () => {
    expect(
      deriveDailyPracticeTargetQuestionCount({
        dueReviewCount: 2,
        reinforcementCount: 0,
        newSequenceCount: 10,
      }),
    ).toBe(3);
  });

  it('grows the set size as review pressure increases', () => {
    expect(
      deriveDailyPracticeTargetQuestionCount({
        dueReviewCount: 16,
        reinforcementCount: 4,
        newSequenceCount: 0,
      }),
    ).toBe(5);
  });

  it('clamps the set to the configured ceiling even under heavy review pressure', () => {
    expect(
      deriveDailyPracticeTargetQuestionCount({
        dueReviewCount: 40,
        reinforcementCount: 10,
        newSequenceCount: 0,
      }),
    ).toBe(6);
  });

  it('does not inflate set size from new-sequence inventory', () => {
    expect(
      deriveDailyPracticeTargetQuestionCount({
        dueReviewCount: 4,
        reinforcementCount: 0,
        newSequenceCount: 100,
      }),
    ).toBe(3);
  });

  it('returns a zero-plan when total eligible inventory is below the minimum floor', () => {
    expect(
      buildDailyPracticeSelectionPlan({
        dueReviewCount: 1,
        reinforcementCount: 0,
        newSequenceCount: 1,
      }),
    ).toEqual({
      targetQuestionCount: 0,
      dueReviewQuota: 0,
      newSequenceQuota: 0,
      reinforcementQuota: 0,
    });
  });

  it('derives quotas proportionally from the target size instead of hardcoded cases', () => {
    const inventory: DailyPracticeSelectionInventory = {
      dueReviewCount: 20,
      reinforcementCount: 5,
      newSequenceCount: 5,
    };

    expect(buildDailyPracticeSelectionPlan(inventory, 3)).toEqual({
      targetQuestionCount: 3,
      dueReviewQuota: 2,
      newSequenceQuota: 0,
      reinforcementQuota: 1,
    });
    expect(buildDailyPracticeSelectionPlan(inventory, 4)).toEqual({
      targetQuestionCount: 4,
      dueReviewQuota: 2,
      newSequenceQuota: 1,
      reinforcementQuota: 1,
    });
    expect(buildDailyPracticeSelectionPlan(inventory, 5)).toEqual({
      targetQuestionCount: 5,
      dueReviewQuota: 3,
      newSequenceQuota: 1,
      reinforcementQuota: 1,
    });
    expect(buildDailyPracticeSelectionPlan(inventory, 6)).toEqual({
      targetQuestionCount: 6,
      dueReviewQuota: 4,
      newSequenceQuota: 1,
      reinforcementQuota: 1,
    });
  });
});
