// Verifies shared roster helper rules so mastery scoring changes fail fast before they skew tutor analytics.
import {
  buildExpMap,
  buildNestedExpMap,
  computeAverageMastery,
  computeLessonMasteryScore,
  formatFullName,
  groupByField,
  median,
  percentageFromRatio,
  toIsoOrNull,
  toTimestampOrZero,
} from './roster.helpers';
import { ExpLedgerEventTypes } from '@scholarxp/constants';

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

    it('returns zero when there are no lessons to average', () => {
      expect(computeAverageMastery([], () => undefined)).toBe(0);
    });
  });

  it('builds flat and nested exp maps while skipping null keys and null sums', () => {
    const entries = [
      {
        userId: 1,
        moduleUnitId: 10,
        eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
        _sum: { awardedExp: null },
      },
      {
        userId: 1,
        moduleUnitId: 10,
        eventType: ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED,
        _sum: { awardedExp: 70 },
      },
      {
        userId: 2,
        moduleUnitId: null,
        eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
        _sum: { awardedExp: 100 },
      },
    ];

    const flat = buildExpMap(entries, (entry) => entry.moduleUnitId);
    const nested = buildNestedExpMap(
      entries,
      (entry) => entry.userId,
      (entry) => entry.moduleUnitId,
    );

    expect(flat.get(10)).toEqual({ completionExp: 0, masteryExp: 70 });
    expect(flat.has(null as never)).toBe(false);
    expect(nested.get(1)?.get(10)).toEqual({
      completionExp: 0,
      masteryExp: 70,
    });
    expect(nested.get(2)).toBeUndefined();
  });

  it('formats utility outputs for nulls, percentages, timestamps, names, grouping, and medians', () => {
    const date = new Date('2026-03-01T00:00:00.000Z');

    expect(percentageFromRatio(2, 4)).toBe(50);
    expect(percentageFromRatio(2, 0)).toBe(0);
    expect(formatFullName('Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(toIsoOrNull(date)).toBe('2026-03-01T00:00:00.000Z');
    expect(toIsoOrNull(null)).toBeNull();
    expect(toTimestampOrZero(date)).toBe(date.getTime());
    expect(toTimestampOrZero('2026-03-01T00:00:00.000Z')).toBe(date.getTime());
    expect(toTimestampOrZero(undefined)).toBe(0);
    expect(groupByField(['a', 'bb', 'c'], (value) => value.length)).toEqual(
      new Map([
        [1, ['a', 'c']],
        [2, ['bb']],
      ]),
    );
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
