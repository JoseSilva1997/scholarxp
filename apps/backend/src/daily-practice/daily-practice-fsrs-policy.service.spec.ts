// Role: verifies the daily-practice FSRS policy skips intraday learning steps, snaps due dates to local midnight, and adjusts the seeded state by acquisition evidence.
import {
  DailyPracticeAlgorithmVersionValues,
  FsrsCardStateValues,
  FsrsReviewGradeValues,
} from '@scholarxp/api-contracts';
import { DailyPracticeFsrsPolicyService } from './daily-practice-fsrs-policy.service';
import type { StudentQuestionStateRecord } from './daily-practice.types';

describe('DailyPracticeFsrsPolicyService', () => {
  let policy: DailyPracticeFsrsPolicyService;

  const reviewedAt = new Date('2026-04-18T10:00:00.000Z');

  beforeEach(() => {
    policy = new DailyPracticeFsrsPolicyService();
  });

  describe('computeSeedStateForFirstCorrect', () => {
    it('produces valid (non-NaN) stability, difficulty, and due values and persists as review', () => {
      const seed = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 0,
          priorHintedAttempts: 0,
          timeToFirstCorrectMs: 5000,
        },
      });

      expect(Number.isFinite(seed.stability)).toBe(true);
      expect(Number.isFinite(seed.difficulty)).toBe(true);
      expect(seed.stability).toBeGreaterThan(0);
      expect(seed.dueAt.getTime()).not.toBeNaN();
      expect(seed.state).toBe(FsrsCardStateValues.review);
      expect(seed.reps).toBeGreaterThanOrEqual(1);
    });

    it('snaps due to UTC midnight when the learner timezone is UTC', () => {
      const seed = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 0,
          priorHintedAttempts: 0,
          timeToFirstCorrectMs: 5000,
        },
      });

      const iso = seed.dueAt.toISOString();
      expect(iso.endsWith('T00:00:00.000Z')).toBe(true);
      expect(seed.dueAt.getTime()).toBeGreaterThan(reviewedAt.getTime());
    });

    it('snaps due to the user local midnight for non-UTC timezones (America/New_York)', () => {
      const seed = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'America/New_York',
        evidence: {
          priorFailedAttempts: 0,
          priorHintedAttempts: 0,
          timeToFirstCorrectMs: 5000,
        },
      });

      // Local midnight in America/New_York during DST is 04:00 UTC.
      const iso = seed.dueAt.toISOString();
      expect(iso.endsWith('T04:00:00.000Z')).toBe(true);
    });

    it('snaps due to the user local midnight for Asia/Tokyo (positive offset)', () => {
      const seed = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'Asia/Tokyo',
        evidence: {
          priorFailedAttempts: 0,
          priorHintedAttempts: 0,
          timeToFirstCorrectMs: 5000,
        },
      });

      // Local midnight in Asia/Tokyo (UTC+9) is 15:00 UTC the day before.
      const iso = seed.dueAt.toISOString();
      expect(iso.endsWith('T15:00:00.000Z')).toBe(true);
    });

    it('seeds higher stability and lower difficulty for an easy acquisition than for a struggled one', () => {
      const easy = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 0,
          priorHintedAttempts: 0,
          timeToFirstCorrectMs: 4000,
        },
      });
      const struggled = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 3,
          priorHintedAttempts: 1,
          timeToFirstCorrectMs: 90_000,
        },
      });

      expect(easy.stability).toBeGreaterThan(struggled.stability);
      expect(struggled.difficulty).toBeGreaterThan(easy.difficulty);
      // Due-date snapping is independent of evidence, both must land on a local midnight boundary.
      expect(easy.dueAt.toISOString().endsWith('T00:00:00.000Z')).toBe(true);
      expect(struggled.dueAt.toISOString().endsWith('T00:00:00.000Z')).toBe(
        true,
      );
    });

    it('clamps stability at a positive floor even under extreme penalties', () => {
      const seed = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 100,
          priorHintedAttempts: 100,
          timeToFirstCorrectMs: 10 * 60 * 1000,
        },
      });

      expect(seed.stability).toBeGreaterThan(0);
      expect(Number.isFinite(seed.stability)).toBe(true);
    });

    it('seeds the due date to the next local day after reviewedAt regardless of grade or evidence', () => {
      // 2026-04-18T10:00Z is mid-day UTC, so the next local UTC midnight is 2026-04-19T00:00Z exactly.
      const expectedDue = new Date('2026-04-19T00:00:00.000Z');

      const cleanGood = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 0,
          priorHintedAttempts: 0,
          timeToFirstCorrectMs: 4000,
        },
      });
      const struggledGood = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 5,
          priorHintedAttempts: 3,
          timeToFirstCorrectMs: 120_000,
        },
      });
      const hard = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.hard,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 0,
          priorHintedAttempts: 0,
          timeToFirstCorrectMs: 4000,
        },
      });

      // All freshly-seeded cards must come back the very next local day. Struggle ordering is delegated to the daily-practice set selector, not the due date.
      expect(cleanGood.dueAt).toEqual(expectedDue);
      expect(struggledGood.dueAt).toEqual(expectedDue);
      expect(hard.dueAt).toEqual(expectedDue);
    });

    it('clamps difficulty within [1, 10]', () => {
      const seed = policy.computeSeedStateForFirstCorrect({
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'UTC',
        evidence: {
          priorFailedAttempts: 100,
          priorHintedAttempts: 100,
          timeToFirstCorrectMs: 60_000,
        },
      });

      expect(seed.difficulty).toBeGreaterThanOrEqual(1);
      expect(seed.difficulty).toBeLessThanOrEqual(10);
    });
  });

  describe('computeNextStateForExisting', () => {
    it('produces a review-state update with finite stability and a local-midnight due date', () => {
      const existingState: StudentQuestionStateRecord = {
        id: 'state-1',
        userId: 42,
        moduleId: 7,
        moduleUnitId: 15,
        questionUnitId: 91,
        fsrsState: FsrsCardStateValues.review,
        fsrsDifficulty: 4.5,
        fsrsStability: 5.2,
        fsrsDueAt: new Date('2026-04-18T10:00:00.000Z'),
        fsrsLastReviewedAt: new Date('2026-04-15T10:00:00.000Z'),
        reviewCount: 3,
        lapseCount: 0,
        lastGrade: FsrsReviewGradeValues.good,
        lastSeenAt: new Date('2026-04-15T10:00:00.000Z'),
        lastCorrectAt: new Date('2026-04-15T10:00:00.000Z'),
        recentAvgTimeMs: 6000,
        firstSeenAt: new Date('2026-04-10T10:00:00.000Z'),
        algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
      };

      const next = policy.computeNextStateForExisting({
        existingState,
        grade: FsrsReviewGradeValues.good,
        reviewedAt,
        timezone: 'America/New_York',
      });

      expect(Number.isFinite(next.stability)).toBe(true);
      expect(next.dueAt.getTime()).not.toBeNaN();
      expect(next.state).toBe(FsrsCardStateValues.review);
      expect(next.dueAt.toISOString().endsWith('T04:00:00.000Z')).toBe(true);
      expect(next.reps).toBe(existingState.reviewCount + 1);
    });

    it('increments lapses when an existing review card is graded again', () => {
      const existingState: StudentQuestionStateRecord = {
        id: 'state-2',
        userId: 42,
        moduleId: 7,
        moduleUnitId: 15,
        questionUnitId: 91,
        fsrsState: FsrsCardStateValues.review,
        fsrsDifficulty: 4.5,
        fsrsStability: 5.2,
        fsrsDueAt: new Date('2026-04-18T10:00:00.000Z'),
        fsrsLastReviewedAt: new Date('2026-04-15T10:00:00.000Z'),
        reviewCount: 3,
        lapseCount: 0,
        lastGrade: FsrsReviewGradeValues.good,
        lastSeenAt: new Date('2026-04-15T10:00:00.000Z'),
        lastCorrectAt: new Date('2026-04-15T10:00:00.000Z'),
        recentAvgTimeMs: 6000,
        firstSeenAt: new Date('2026-04-10T10:00:00.000Z'),
        algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
      };

      const next = policy.computeNextStateForExisting({
        existingState,
        grade: FsrsReviewGradeValues.again,
        reviewedAt,
        timezone: 'UTC',
      });

      expect(next.lapses).toBe(1);
      expect(next.state).toBe(FsrsCardStateValues.review);
    });
  });
});
