// Centralizes shared roster scoring and formatting rules so student and lesson analytics stay consistent.
import {
  ExpLedgerEventTypes,
  MASTERY_TOTAL_EXP,
  MODULE_UNIT_BASELINE_EXP,
  ROSTER_MASTERY_COMPLETION_WEIGHT,
  ROSTER_MASTERY_EXP_WEIGHT,
} from '@scholarxp/constants';

// Defines the rolling window used for "at risk" and "active" student classifications.
export const ACTIVITY_WINDOW_DAYS = 7;

// Mastery event types are spader-EXP events that count towards a student's mastery score,
// as opposed to CORRECT_PRACTICE_ROOM_ANSWER which represents lesson completion progress.
export const MASTERY_EVENT_TYPES = [
  ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED,
  ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_GRADUATED,
  ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED,
] as const;

export type LessonExp = { completionExp: number; masteryExp: number };

const EMPTY_LESSON_EXP: LessonExp = { completionExp: 0, masteryExp: 0 };

// Returns a Date object representing midnight exactly `days` days before `now`.
export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// Reduces a flat list of grouped EXP ledger entries into a map keyed by the value
// returned by keyFn. Entries are split into completion vs. mastery buckets based on
// their event type, accumulating totals for each key.
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

// Two-dimensional variant of buildExpMap that builds a Map<outerKey, Map<innerKey, LessonExp>>.
// Used when EXP data needs to be cross-referenced by two dimensions simultaneously
// (e.g. student × lesson or lesson × student) without a second database round-trip.
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

// Computes a weighted mastery score in the range [0, 1] for a single lesson.
// Both inputs are capped at their respective maximums before normalisation so a student
// who earns bonus EXP is not credited above 100%. The two rates are then blended using
// the configured weights (ROSTER_MASTERY_COMPLETION_WEIGHT + ROSTER_MASTERY_EXP_WEIGHT = 1).
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

// Returns the average mastery score across all provided keys as an integer percentage (0–100).
// Keys with no EXP data are treated as zero-mastery rather than being excluded, so the
// denominator always equals the total number of keys (e.g. all enrolled students or all lessons).
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

// Safe percentage calculation that returns 0 rather than NaN when the denominator is zero.
export function percentageFromRatio(
  numerator: number,
  denominator: number,
): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

// Converts a nullable Date to an ISO 8601 string, or null if the value is absent.
export function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

// Converts a nullable date value to a Unix timestamp in milliseconds, returning 0 when absent.
// Returning 0 rather than null allows nulls to sort to the beginning of ascending date sorts.
export function toTimestampOrZero(
  value: string | Date | null | undefined,
): number {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

// Converts a fractional score (0–1) to an integer percentage (0–100).
export function roundScoreToPercent(score: number): number {
  return Math.round(score * 100);
}

// Generic group-by utility that partitions an array into a Map of buckets.
// Follows the same semantics as lodash groupBy but avoids an external dependency.
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

// Returns the statistical median of an array of numbers. For even-length arrays
// it averages the two central values, matching the standard statistical definition.
export function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}
