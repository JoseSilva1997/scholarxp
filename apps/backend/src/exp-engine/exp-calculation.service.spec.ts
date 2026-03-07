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
    it('returns 0 for streak under 3 or no questions', () => {
      expect(service.resolveReachedStreakTier(2, 10)).toBe(0);
      expect(service.resolveReachedStreakTier(5, 0)).toBe(0);
    });

    it('calculates tier 1 (>= 30% or 3 max)', () => {
      // 30% of 10 is 3
      expect(service.resolveReachedStreakTier(3, 10)).toBe(1);
      expect(service.resolveReachedStreakTier(4, 10)).toBe(1);
    });

    it('calculates tier 2 (>= 50% or 3 max)', () => {
      // 50% of 10 is 5
      expect(service.resolveReachedStreakTier(5, 10)).toBe(2);
      expect(service.resolveReachedStreakTier(9, 10)).toBe(2);
    });

    it('calculates tier 3 (100% or 3 max)', () => {
      expect(service.resolveReachedStreakTier(10, 10)).toBe(3);
    });

    it('handles small lessons (e.g. 5 questions) with minimum clamps correctly', () => {
      // 30% of 5 = 1.5 -> Math.max(3, 2) = 3
      // 50% of 5 = 2.5 -> Math.max(3, 3) = 3
      // 100% of 5 = 5  -> Math.max(3, 5) = 5
      expect(service.resolveReachedStreakTier(3, 5)).toBe(2); // Since 30% is clamped to 3 and 50% is clamped to 3, it hits tier 2
      expect(service.resolveReachedStreakTier(4, 5)).toBe(2);
      expect(service.resolveReachedStreakTier(5, 5)).toBe(3);
    });
  });
});
