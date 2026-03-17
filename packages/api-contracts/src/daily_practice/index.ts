/**
 * Shared contracts for the module-scoped daily-practice domain.
 * These types keep persisted adaptive-learning state aligned between backend and frontend.
 */

// Keep algorithm version values contract-owned so backend selectors can evolve
// without introducing database enums for each tuning change.
export const DailyPracticeAlgorithmVersionValues = {
  fsrsV1: 'fsrs_v1',
} as const;

export type DailyPracticeAlgorithmVersion =
  (typeof DailyPracticeAlgorithmVersionValues)[keyof typeof DailyPracticeAlgorithmVersionValues];

// FSRS card states are stored as strings so future scheduling iterations stay migration-light.
export const FsrsCardStateValues = {
  new: 'new',
  learning: 'learning',
  review: 'review',
  relearning: 'relearning',
} as const;

export type FsrsCardState =
  (typeof FsrsCardStateValues)[keyof typeof FsrsCardStateValues];

// Review grades remain shared so encounter-to-grade mapping is defined once across the stack.
export const FsrsReviewGradeValues = {
  again: 'again',
  hard: 'hard',
  good: 'good',
  easy: 'easy',
} as const;

export type FsrsReviewGrade =
  (typeof FsrsReviewGradeValues)[keyof typeof FsrsReviewGradeValues];

// Bucket values are intentionally stable because they drive selector quotas and UI explanations.
export const DailyPracticeSelectionBucketValues = {
  dueReview: 'due_review',
  newSequence: 'new_sequence',
  reinforcement: 'reinforcement',
} as const;

export type DailyPracticeSelectionBucket =
  (typeof DailyPracticeSelectionBucketValues)[keyof typeof DailyPracticeSelectionBucketValues];

// Per-student per-question adaptive state persisted after FSRS-backed review encounters.
export interface StudentQuestionState {
  id: string;
  userId: number;
  moduleId: number;
  moduleUnitId: number;
  questionUnitId: number;
  fsrsState: FsrsCardState;
  fsrsDifficulty: number;
  fsrsStability: number;
  fsrsDueAt: string;
  fsrsLastReviewedAt: string | null;
  reviewCount: number;
  lapseCount: number;
  lastGrade: FsrsReviewGrade | null;
  lastSeenAt: string | null;
  lastCorrectAt: string | null;
  recentAvgTimeMs: number | null;
  firstSeenAt: string | null;
  algorithmVersion: DailyPracticeAlgorithmVersion;
}

// One persisted daily set per student and module keeps the set stable across a UTC day.
export interface DailyPracticeSet {
  id: string;
  userId: number;
  moduleId: number;
  practiceDateUtc: string;
  generatedAt: string;
  completedAt: string | null;
  algorithmVersion: DailyPracticeAlgorithmVersion;
  items?: DailyPracticeSetItem[];
}

// Persisted set items capture both the chosen question order and why it was selected.
export interface DailyPracticeSetItem {
  id: string;
  dailyPracticeSetId: string;
  questionUnitId: number;
  moduleUnitId: number;
  position: number;
  selectionReason: string;
  selectionScore: number;
  sourceBucket: DailyPracticeSelectionBucket;
}
