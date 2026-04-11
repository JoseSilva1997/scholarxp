// Centralizes shared roster scoring and formatting rules so student and lesson analytics stay consistent.
import {
  ExpLedgerEventTypes,
  MASTERY_TOTAL_EXP,
  MODULE_UNIT_BASELINE_EXP,
  ROSTER_MASTERY_COMPLETION_WEIGHT,
  ROSTER_MASTERY_EXP_WEIGHT,
} from '@scholarxp/constants';

export const ACTIVITY_WINDOW_DAYS = 7;

export const MASTERY_EVENT_TYPES = [
  ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED,
  ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_GRADUATED,
  ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED,
] as const;

export type LessonExp = { completionExp: number; masteryExp: number };

const EMPTY_LESSON_EXP: LessonExp = { completionExp: 0, masteryExp: 0 };

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function buildExpMap<
  T extends { eventType: string; _sum: { awardedExp: number | null } },
>(entries: T[], keyFn: (entry: T) => number | null): Map<number, LessonExp> {
  const map = new Map<number, LessonExp>();

  for (const entry of entries) {
    const key = keyFn(entry);
    if (key === null) continue;

    const accumulator = map.get(key) ?? { ...EMPTY_LESSON_EXP };
    const amount = entry._sum.awardedExp ?? 0;

    if (entry.eventType === ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER) {
      accumulator.completionExp += amount;
    } else {
      accumulator.masteryExp += amount;
    }

    map.set(key, accumulator);
  }

  return map;
}

export function buildNestedExpMap<
  T extends { eventType: string; _sum: { awardedExp: number | null } },
>(
  entries: T[],
  outerKeyFn: (entry: T) => number | null,
  innerKeyFn: (entry: T) => number | null,
): Map<number, Map<number, LessonExp>> {
  const map = new Map<number, Map<number, LessonExp>>();

  for (const entry of entries) {
    const outerKey = outerKeyFn(entry);
    if (outerKey === null) continue;

    const innerKey = innerKeyFn(entry);
    if (innerKey === null) continue;

    const innerMap = map.get(outerKey) ?? new Map<number, LessonExp>();
    const accumulator = innerMap.get(innerKey) ?? { ...EMPTY_LESSON_EXP };
    const amount = entry._sum.awardedExp ?? 0;

    if (entry.eventType === ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER) {
      accumulator.completionExp += amount;
    } else {
      accumulator.masteryExp += amount;
    }

    innerMap.set(innerKey, accumulator);
    map.set(outerKey, innerMap);
  }

  return map;
}

export function computeLessonMasteryScore(
  completionExp: number,
  masteryExp: number,
): number {
  const completionRate =
    Math.min(completionExp, MODULE_UNIT_BASELINE_EXP) /
    MODULE_UNIT_BASELINE_EXP;
  const masteryRate =
    Math.min(masteryExp, MASTERY_TOTAL_EXP) / MASTERY_TOTAL_EXP;

  return (
    completionRate * ROSTER_MASTERY_COMPLETION_WEIGHT +
    masteryRate * ROSTER_MASTERY_EXP_WEIGHT
  );
}

export function computeAverageMastery<K>(
  keys: K[],
  getExp: (key: K) => LessonExp | undefined,
): number {
  if (keys.length === 0) return 0;

  let masterySum = 0;
  for (const key of keys) {
    const exp = getExp(key) ?? EMPTY_LESSON_EXP;
    masterySum += computeLessonMasteryScore(exp.completionExp, exp.masteryExp);
  }

  return Math.round((masterySum / keys.length) * 100);
}

export function percentageFromRatio(
  numerator: number,
  denominator: number,
): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

export function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toTimestampOrZero(
  value: string | Date | null | undefined,
): number {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function roundScoreToPercent(score: number): number {
  return Math.round(score * 100);
}

export function groupByField<K, V>(
  items: V[],
  keyFn: (item: V) => K,
): Map<K, V[]> {
  const map = new Map<K, V[]>();

  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }

  return map;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}
