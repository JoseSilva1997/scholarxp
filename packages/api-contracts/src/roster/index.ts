// Module-scoped roster contracts: tutor-facing analytics for student enrollment, lesson coverage, and review health.
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
  | 'completed_lessons'
  | 'due_review_count';

export type RosterLessonSortBy =
  | 'title'
  | 'completion_rate'
  | 'average_mastery'
  | 'last_practiced';

export type RosterReviewSortBy =
  | 'name'
  | 'due_review_count'
  | 'overdue_review_count'
  | 'lapse_count';

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

export interface RosterReviewQuery {
  sortBy?: RosterReviewSortBy;
  sortDirection?: SortDirection;
}

// --- Summary endpoint ---

export interface RosterLessonCoverage {
  totalLiveLessons: number;
  lessonsStartedByAtLeastOneStudent: number;
  lessonsCompletedByAtLeastOneStudent: number;
}

export interface RosterReviewBacklog {
  studentsWithOverdueReviews: number;
  totalOverdueReviews: number;
}

export interface RosterSummaryResponse {
  moduleId: number;
  moduleTitle: string;
  studentsEnrolled: number;
  activeLast7Days: number;
  atRiskCount: number;
  lessonCoverage: RosterLessonCoverage;
  reviewBacklog: RosterReviewBacklog;
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
  dueReviewCount: number;
  overdueReviewCount: number;
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

// --- Review list endpoint ---

export interface RosterReviewRow {
  studentId: number;
  fullName: string;
  avatarUrl: string;
  dueReviewCount: number;
  overdueReviewCount: number;
  lapseCount: number;
  dailyPracticeStatus: DailyPracticeStatus;
  lastDailyPracticeCompletedAt: string | null;
}

export interface RosterReviewResponse {
  rows: RosterReviewRow[];
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

export interface RosterStudentReviewState {
  dueReviewCount: number;
  overdueReviewCount: number;
  lapseCount: number;
  lastDailyPracticeCompletedAt: string | null;
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
  reviewState: RosterStudentReviewState;
  recentPerformance: RosterStudentRecentPerformance;
}
