// Module-scoped roster contracts: tutor-facing analytics for student enrollment, lesson coverage, and per-student metrics.
import type { DailyPracticeStatus } from '../daily_practice';
import type { ModuleUnitStatus } from '../modules';

// --- Query params ---

export type RosterStudentFilter =
  | 'all'
  | 'active_7d'
  | 'inactive_7d'
  | 'at_risk'
  | 'daily_practice_locked'
  | 'daily_practice_unlocked';

export type RosterStudentSortBy =
  | 'name'
  | 'last_activity'
  | 'completed_lessons';

export type RosterLessonSortBy =
  | 'title'
  | 'completion_rate'
  | 'average_mastery'
  | 'last_practiced';

export type SortDirection = 'asc' | 'desc';

export interface RosterStudentsQuery {
  filter?: RosterStudentFilter;
  sortBy?: RosterStudentSortBy;
  sortDirection?: SortDirection;
  search?: string;
}

export interface RosterLessonsQuery {
  sortBy?: RosterLessonSortBy;
  sortDirection?: SortDirection;
}

// --- Summary endpoint ---

export interface RosterLessonCoverage {
  totalLiveLessons: number;
  lessonsStartedByAtLeastOneStudent: number;
  lessonsCompletedByAtLeastOneStudent: number;
}

export interface RosterSummaryResponse {
  moduleId: number;
  moduleTitle: string;
  studentsEnrolled: number;
  activeLast7Days: number;
  atRiskCount: number;
  lessonCoverage: RosterLessonCoverage;
}

// --- Students list endpoint ---

export interface RosterStudentRow {
  studentId: number;
  fullName: string;
  avatarUrl: string;
  moduleLevel: number;
  currentXp: number;
  completedLessons: number;
  totalLiveLessons: number;
  averageMastery: number;
  dailyPracticeStatus: DailyPracticeStatus;
  lastDailyPracticeCompletedAt: string | null;
  lastActivityAt: string | null;
  enrolledAt: string;
  enrolledVia: string;
  isAtRisk: boolean;
}

export interface RosterStudentsResponse {
  rows: RosterStudentRow[];
}

// --- Lessons list endpoint ---

export interface RosterLessonRow {
  moduleUnitId: number;
  title: string;
  status: ModuleUnitStatus;
  studentsStarted: number;
  studentsCompleted: number;
  completionRate: number;
  averageMastery: number;
  lastPracticedAt: string | null;
}

export interface RosterLessonsResponse {
  rows: RosterLessonRow[];
}

// --- Lesson drilldown endpoint ---

// Student row within the lesson drilldown — un-aggregates moduleUnitUserProgress per student.
export interface LessonDrilldownStudentRow {
  studentId: number;
  fullName: string;
  avatarUrl: string | null;
  isCompleted: boolean;
  masteryScore: number | null;     // 0–100 or null if never practiced
  lastPracticedAt: string | null;  // ISO date string
}

// Per-question accuracy summary used across multiple question-health sections.
export interface QuestionAccuracySummary {
  questionId: number;
  questionTitle: string;
  totalAttempts: number;            // total attempt rows (all students, all tries)
  firstAttemptAccuracy: number;     // 0–100
  overallAccuracy: number;          // 0–100
}

// Core vs. variant discrepancy entry — surfaces when a variant diverges from core by ≥ 15pp.
export interface QuestionVariantDiscrepancy {
  questionId: number;
  questionTitle: string;
  coreAccuracy: number;             // first-attempt accuracy on isCore content
  coreAttempts: number;
  variantLabel: string;
  variantAccuracy: number;          // first-attempt accuracy on variant content
  variantAttempts: number;
  delta: number;                    // variantAccuracy - coreAccuracy (signed)
}

// Slow question entry — questions whose median response time exceeds 2× the lesson median.
export interface SlowQuestionRow {
  questionId: number;
  questionTitle: string;
  medianTimeSec: number;            // median timeTakenMs / 1000, after cap and session-opener exclusion
  lessonMedianTimeSec: number;      // lesson-level median for context
  qualifyingAttempts: number;       // attempts that passed cap + session-opener filter
}

// High hint usage entry — questions where ≥ 40% of first attempts used the hint.
export interface HighHintUsageRow {
  questionId: number;
  questionTitle: string;
  hintUsageRate: number;            // 0–100, % of first attempts with hintsUsed > 0
  studentsWithHint: number;
  totalStudents: number;
}

export interface LessonDrilldownResponse {
  moduleUnitId: number;
  lessonTitle: string;
  students: LessonDrilldownStudentRow[];
  questionHealth: {
    strugglingQuestions: QuestionAccuracySummary[];   // sorted by firstAttemptAccuracy ASC, max 10
    variantDiscrepancies: QuestionVariantDiscrepancy[];
    highHintUsage: HighHintUsageRow[];                // sorted by hintUsageRate DESC
    slowQuestions: SlowQuestionRow[];                 // sorted by medianTimeSec DESC
  };
}

// --- Student detail endpoint ---

export interface RosterStudentLessonProgress {
  moduleUnitId: number;
  lessonTitle: string;
  isCompleted: boolean;
  currentMasteryScore: number;
  completedAt: string | null;
  lastPracticedAt: string | null;
}

export interface RosterStudentRecentPerformance {
  accuracyLast7Days: number | null;
  averageTimeMsLast7Days: number | null;
  hintsUsedLast7Days: number | null;
}

export interface RosterStudentDetailResponse {
  student: {
    studentId: number;
    fullName: string;
    avatarUrl: string;
    enrolledAt: string;
    enrolledVia: string;
    moduleLevel: number;
    currentXp: number;
    completedLessons: number;
    totalLiveLessons: number;
    averageMastery: number;
    dailyPracticeStatus: DailyPracticeStatus;
    lastActivityAt: string | null;
  };
  lessonProgress: RosterStudentLessonProgress[];
  recentPerformance: RosterStudentRecentPerformance;
}
