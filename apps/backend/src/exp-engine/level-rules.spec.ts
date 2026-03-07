import {
  getLevelStartExp,
  getLevelFromTotalExp,
  getProgressWithinLevel,
} from './level-rules';

describe('Level Rules Math Utilities', () => {
  describe('account XP curve helpers', () => {
    it('returns the expected level start XP values', () => {
      expect(getLevelStartExp(1)).toBe(0);
      expect(getLevelStartExp(2)).toBe(100);
      expect(getLevelStartExp(3)).toBe(282);
    });

    it('derives level from total XP using the inverse curve', () => {
      expect(getLevelFromTotalExp(0)).toBe(1);
      expect(getLevelFromTotalExp(99)).toBe(1);
      expect(getLevelFromTotalExp(100)).toBe(2);
      expect(getLevelFromTotalExp(283)).toBe(3);
    });

    it('returns current-level progress snapshot from total XP', () => {
      const progress = getProgressWithinLevel(350);

      expect(progress.level).toBe(3);
      expect(progress.currentLevelExp).toBe(68);
      expect(progress.nextLevelExpRequired).toBe(237);
      expect(progress.xpToNextLevel).toBe(169);
      expect(progress.progressPercent).toBeCloseTo(28.69, 2);
    });
  });
});
