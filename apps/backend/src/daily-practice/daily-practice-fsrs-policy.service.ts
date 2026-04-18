// Role: applies daily-practice FSRS transitions with intraday learning steps disabled and due dates snapped to local day boundaries.
import { Injectable } from '@nestjs/common';
import {
  FsrsCardStateValues,
  FsrsReviewGradeValues,
  type FsrsCardState,
  type FsrsReviewGrade,
} from '@scholarxp/api-contracts';
import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade,
} from 'ts-fsrs';
import { DateHelpers } from '../helpers/helpers';
import type { StudentQuestionStateRecord } from './daily-practice.types';

export type DailyPracticeFsrsGrade = Exclude<
  FsrsReviewGrade,
  typeof FsrsReviewGradeValues.easy
>;

// Acquisition evidence summarizes what the learner had to go through before the first successful encounter for a question.
// It biases the initial seeded memory state so two learners who both eventually got it right but took very different paths are not treated identically.
export type AcquisitionEvidence = {
  priorFailedAttempts: number;
  priorHintedAttempts: number;
  timeToFirstCorrectMs: number;
};

export type PolicyCardUpdate = {
  state: FsrsCardState;
  stability: number;
  difficulty: number;
  dueAt: Date;
  reps: number;
  lapses: number;
};

// Intentionally small coefficients so acquisition evidence nudges the FSRS base values rather than overwhelming them.
const STABILITY_FAIL_WEIGHT = 0.4;
const STABILITY_HINT_WEIGHT = 0.2;
const DIFFICULTY_FAIL_BUMP = 0.5;
const DIFFICULTY_HINT_BUMP = 0.25;
// Time-to-first-correct > 30s signals a struggled acquisition that deserves a modest stability penalty.
const TIME_PENALTY_THRESHOLD_MS = 30_000;
const TIME_PENALTY_FACTOR = 0.9;
const STABILITY_FLOOR = 0.1;
const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 10;

@Injectable()
export class DailyPracticeFsrsPolicyService {
  // enable_short_term=false skips FSRS learning/relearning steps so daily practice stays a day-granularity schedule and first-success values land directly in Review.
  private readonly scheduler = fsrs({ enable_short_term: false });

  computeSeedStateForFirstCorrect(params: {
    grade: DailyPracticeFsrsGrade;
    reviewedAt: Date;
    timezone: string;
    evidence: AcquisitionEvidence;
  }): PolicyCardUpdate {
    const baseCard = this.scheduler.next(
      createEmptyCard(params.reviewedAt),
      params.reviewedAt,
      this.toRating(params.grade),
      (log) => log.card,
    );
    const adjusted = this.adjustBaseWithAcquisitionEvidence(
      baseCard,
      params.evidence,
    );

    return {
      // Persist as Review regardless of the enum ts-fsrs returns — intraday Learning is disabled and a seeded card is, by policy, eligible for day-level review.
      state: FsrsCardStateValues.review,
      stability: adjusted.stability,
      difficulty: adjusted.difficulty,
      // Seeded cards always come back the next local day; the daily-practice set selector — not the FSRS scheduler — orders questions by struggle from there onward.
      dueAt: this.nextLocalDay(params.reviewedAt, params.timezone),
      reps: adjusted.reps,
      lapses: adjusted.lapses,
    };
  }

  computeNextStateForExisting(params: {
    existingState: StudentQuestionStateRecord;
    grade: DailyPracticeFsrsGrade;
    reviewedAt: Date;
    timezone: string;
  }): PolicyCardUpdate {
    const card = this.toFsrsCard(params.existingState);
    const next = this.scheduler.next(
      card,
      params.reviewedAt,
      this.toRating(params.grade),
      (log) => log.card,
    );

    return {
      state: FsrsCardStateValues.review,
      stability: next.stability,
      difficulty: next.difficulty,
      dueAt: this.snapDueToLocalDay(next.due, params.timezone),
      reps: next.reps,
      lapses: next.lapses,
    };
  }

  private adjustBaseWithAcquisitionEvidence(
    base: Card,
    evidence: AcquisitionEvidence,
  ): Card {
    const stabilityPenalty =
      1 /
      (1 +
        STABILITY_FAIL_WEIGHT * Math.max(0, evidence.priorFailedAttempts) +
        STABILITY_HINT_WEIGHT * Math.max(0, evidence.priorHintedAttempts));
    const timePenalty =
      evidence.timeToFirstCorrectMs > TIME_PENALTY_THRESHOLD_MS
        ? TIME_PENALTY_FACTOR
        : 1;
    const adjustedStability = Math.max(
      STABILITY_FLOOR,
      base.stability * stabilityPenalty * timePenalty,
    );
    const difficultyBump =
      DIFFICULTY_FAIL_BUMP * Math.max(0, evidence.priorFailedAttempts) +
      DIFFICULTY_HINT_BUMP * Math.max(0, evidence.priorHintedAttempts);
    const adjustedDifficulty = Math.min(
      DIFFICULTY_MAX,
      Math.max(DIFFICULTY_MIN, base.difficulty + difficultyBump),
    );

    return {
      ...base,
      stability: adjustedStability,
      difficulty: adjustedDifficulty,
    };
  }

  // Returns UTC instant for local midnight of the day containing `due`, giving the learner the full local day to review.
  private snapDueToLocalDay(due: Date, timezone: string): Date {
    return DateHelpers.getLocalDayBounds(due, timezone).dayStartUtc;
  }

  // UTC instant for the start of the next local day after `reviewedAt`. Used to seed fresh cards so newly-acquired questions resurface on the very next daily-practice generation.
  private nextLocalDay(reviewedAt: Date, timezone: string): Date {
    return DateHelpers.getLocalDayBounds(reviewedAt, timezone).nextDayStartUtc;
  }

  private toRating(grade: DailyPracticeFsrsGrade): Grade {
    if (grade === FsrsReviewGradeValues.again) {
      return Rating.Again as Grade;
    }

    if (grade === FsrsReviewGradeValues.hard) {
      return Rating.Hard as Grade;
    }

    return Rating.Good as Grade;
  }

  private toFsrsCard(state: StudentQuestionStateRecord): Card {
    return {
      due: state.fsrsDueAt,
      stability: state.fsrsStability,
      difficulty: state.fsrsDifficulty,
      elapsed_days: 0,
      scheduled_days: this.calculateScheduledDays(state),
      learning_steps: 0,
      reps: state.reviewCount,
      lapses: state.lapseCount,
      // Always reconstruct as Review because intraday Learning is off for this product and any persisted non-Review value is legacy data.
      state: State.Review,
      last_review: state.fsrsLastReviewedAt ?? undefined,
    };
  }

  private calculateScheduledDays(state: StudentQuestionStateRecord): number {
    if (!state.fsrsLastReviewedAt) {
      return 0;
    }

    const dayDifference =
      (state.fsrsDueAt.getTime() - state.fsrsLastReviewedAt.getTime()) /
      (24 * 60 * 60 * 1000);

    return Math.max(0, Math.round(dayDifference));
  }
}
