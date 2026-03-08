// Spec role: verifies pure calculation policies for XP awards without needing data mocks.
import { Test, TestingModule } from '@nestjs/testing';
import { ExpCalculationService } from './exp-calculation.service';

describe('ExpCalculationService', () => {
  let service: ExpCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpCalculationService],
    }).compile();

    service = module.get<ExpCalculationService>(ExpCalculationService);
  });

  describe('resolveDailyCompletionReward', () => {
    it('returns 100 for first completion of the day', () => {
      expect(service.resolveDailyCompletionReward(0)).toBe(100);
    });

    it('returns 25 for second completion of the day', () => {
      expect(service.resolveDailyCompletionReward(1)).toBe(25);
    });

    it('returns 0 for third completion onward', () => {
      expect(service.resolveDailyCompletionReward(2)).toBe(0);
      expect(service.resolveDailyCompletionReward(5)).toBe(0);
    });
  });

  describe('getPerQuestionAward', () => {
    it('returns 0 if total questions is 0 or less', () => {
      expect(
        service.getPerQuestionAward({
          totalPoolExp: 1000,
          totalQuestions: 0,
          isLastQuestion: false,
        }),
      ).toBe(0);
    });

    it('distributes floored base share to non-last questions', () => {
      const result = service.getPerQuestionAward({
        totalPoolExp: 1000,
        totalQuestions: 3,
        isLastQuestion: false,
      });
      expect(result).toBe(333); // Math.floor(1000 / 3)
    });

    it('allocates remainder to the last question', () => {
      const result = service.getPerQuestionAward({
        totalPoolExp: 1000,
        totalQuestions: 3,
        isLastQuestion: true,
      });
      expect(result).toBe(334); // 333 + 1 (remainder)
    });
  });

  describe('resolveReachedStreakTier', () => {
    it('returns 0 for units with fewer than 4 questions regardless of streak', () => {
      // Policy: units that are too short don't participate in the streak mechanic.
      expect(service.resolveReachedStreakTier(0, 0)).toBe(0);
      expect(service.resolveReachedStreakTier(3, 1)).toBe(0);
      expect(service.resolveReachedStreakTier(3, 2)).toBe(0);
      // 3-question perfect run — previously this collapsed all tiers to 3, now correctly suppressed.
      expect(service.resolveReachedStreakTier(3, 3)).toBe(0);
    });

    it('returns 0 when streak has not reached any tier threshold', () => {
      // 30% of 10 = 3; streak of 2 is below tier-1 threshold.
      expect(service.resolveReachedStreakTier(2, 10)).toBe(0);
    });

    it('returns 0 for the first valid unit size (4 questions) when streak is below tier-1 threshold', () => {
      // 30% of 4 = 1.2 → ceil = 2 → Math.max(3, 2) = 3; streak of 2 is below 3.
      expect(service.resolveReachedStreakTier(2, 4)).toBe(0);
    });

    it('calculates tier 1 (>= 30% of total, minimum 3) starting at 4-question units', () => {
      // 4-question unit: tier-1 = Math.max(3, ceil(4*0.3)=2) = 3,
      //                  tier-2 = Math.max(3, ceil(4*0.5)=2) = 3  → both collapse to 3.
      // Streak of 3 therefore hits tier 2 directly (same min-clamp behaviour as 5-question units).
      expect(service.resolveReachedStreakTier(3, 4)).toBe(2);
      // 10-question unit: tier-1 threshold = Math.max(3, ceil(10*0.3)) = 3.
      expect(service.resolveReachedStreakTier(3, 10)).toBe(1);
      expect(service.resolveReachedStreakTier(4, 10)).toBe(1);
    });

    it('calculates tier 2 (>= 50% of total, minimum 3)', () => {
      // 10-question unit: tier-2 threshold = Math.max(3, ceil(10 * 0.5)) = 5.
      expect(service.resolveReachedStreakTier(5, 10)).toBe(2);
      expect(service.resolveReachedStreakTier(9, 10)).toBe(2);
    });

    it('calculates tier 3 (100% of total)', () => {
      expect(service.resolveReachedStreakTier(10, 10)).toBe(3);
    });

    it('handles small eligible lessons (5 questions) with minimum threshold clamps correctly', () => {
      // 30% of 5 = 1.5 → ceil = 2 → Math.max(3, 2) = 3
      // 50% of 5 = 2.5 → ceil = 3 → Math.max(3, 3) = 3  (same as tier-1 threshold)
      // So streak of 3 reaches both tier-1 and tier-2 simultaneously → tier 2.
      expect(service.resolveReachedStreakTier(3, 5)).toBe(2);
      expect(service.resolveReachedStreakTier(4, 5)).toBe(2);
      // 100% threshold = Math.max(3, 5) = 5 → tier 3.
      expect(service.resolveReachedStreakTier(5, 5)).toBe(3);
    });
  });
});
