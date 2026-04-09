// Verifies shared roster helper rules so mastery scoring changes fail fast before they skew tutor analytics.
import {
  computeAverageMastery,
  computeLessonMasteryScore,
} from './roster.helpers';

describe('roster.helpers', () => {
  describe('computeLessonMasteryScore', () => {
    it('caps over-earned exp at the configured maximums', () => {
      expect(computeLessonMasteryScore(5_000, 5_000)).toBe(1);
    });

    it('blends completion and mastery exp using the shared roster weights', () => {
      expect(computeLessonMasteryScore(600, 420)).toBeCloseTo(0.6);
    });
  });

  describe('computeAverageMastery', () => {
    it('treats missing lesson exp as zero when averaging across lessons', () => {
      const lessonExp = new Map([
        [10, { completionExp: 1_000, masteryExp: 700 }],
      ]);

      expect(
        computeAverageMastery([10, 11], (lessonId) => lessonExp.get(lessonId)),
      ).toBe(50);
    });
  });
});
