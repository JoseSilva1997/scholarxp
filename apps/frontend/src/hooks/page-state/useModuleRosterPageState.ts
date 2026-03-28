// Orchestrates roster page state: summary cards, detail panel expansion, tab/filter/sort selection, and student drill-down.
import { useEffect, useMemo, useState, useCallback } from 'react';
import type {
  AuthUser,
  RosterStudentFilter,
  RosterStudentSortBy,
  RosterLessonSortBy,
  RosterReviewSortBy,
  SortDirection,
  RosterSummaryResponse,
  RosterStudentRow,
  RosterLessonRow,
  RosterReviewRow,
} from '@scholarxp/api-contracts';
import { features } from '@scholarxp/permissions';
import { canUserAccess } from '../../permissions/permission';
import {
  useRosterSummaryQuery,
  useRosterStudentsQuery,
  useRosterLessonsQuery,
  useRosterReviewQuery,
  useRosterStudentDetailQuery,
} from '../queries/useRosterQueries';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { logError } from '../../utils/logger';

export type RosterTab = 'students' | 'lessons' | 'review';

type UseModuleRosterPageStateParams = {
  moduleIdParam: string | undefined;
  user: AuthUser | null;
};

type UseModuleRosterPageStateResult = {
  parsedId: number | null;
  canViewRoster: boolean;
  isLoading: boolean;
  pageError: string | null;

  // Summary
  summary: RosterSummaryResponse | null;
  isSummaryLoading: boolean;

  // Detail panel
  isDetailOpen: boolean;
  activeTab: RosterTab;
  openDetail: (tab: RosterTab) => void;
  closeDetail: () => void;
  setActiveTab: (tab: RosterTab) => void;

  // Card click handlers — each opens the detail panel with a preset tab/filter/sort
  handleStudentsEnrolledClick: () => void;
  handleActiveLast7DaysClick: () => void;
  handleAtRiskClick: () => void;
  handleLessonCoverageClick: () => void;
  handleReviewBacklogClick: () => void;

  // Students tab state
  studentFilter: RosterStudentFilter;
  setStudentFilter: (filter: RosterStudentFilter) => void;
  studentSortBy: RosterStudentSortBy;
  setStudentSortBy: (sortBy: RosterStudentSortBy) => void;
  studentSortDirection: SortDirection;
  setStudentSortDirection: (dir: SortDirection) => void;
  studentSearch: string;
  setStudentSearch: (search: string) => void;
  studentRows: RosterStudentRow[];
  isStudentsLoading: boolean;
  studentsError: string | null;

  // Lessons tab state
  lessonSortBy: RosterLessonSortBy;
  setLessonSortBy: (sortBy: RosterLessonSortBy) => void;
  lessonSortDirection: SortDirection;
  setLessonSortDirection: (dir: SortDirection) => void;
  lessonRows: RosterLessonRow[];
  isLessonsLoading: boolean;
  lessonsError: string | null;

  // Review tab state
  reviewSortBy: RosterReviewSortBy;
  setReviewSortBy: (sortBy: RosterReviewSortBy) => void;
  reviewSortDirection: SortDirection;
  setReviewSortDirection: (dir: SortDirection) => void;
  reviewRows: RosterReviewRow[];
  isReviewLoading: boolean;
  reviewError: string | null;

  // Student drill-down
  selectedStudentId: number | null;
  selectStudent: (studentId: number) => void;
  clearSelectedStudent: () => void;
  studentDetail: ReturnType<typeof useRosterStudentDetailQuery>['data'] | undefined;
  isStudentDetailLoading: boolean;
  studentDetailError: string | null;
};

export function useModuleRosterPageState({
  moduleIdParam,
  user,
}: UseModuleRosterPageStateParams): UseModuleRosterPageStateResult {
  const parsedId = useMemo(() => {
    if (!moduleIdParam) return null;
    const value = Number(moduleIdParam);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [moduleIdParam]);

  const canViewRoster = useMemo(
    () => canUserAccess(features.modules.roster, user),
    [user],
  );

  // Detail panel state
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RosterTab>('students');

  // Students tab local state
  const [studentFilter, setStudentFilter] = useState<RosterStudentFilter>('all');
  const [studentSortBy, setStudentSortBy] = useState<RosterStudentSortBy>('name');
  const [studentSortDirection, setStudentSortDirection] = useState<SortDirection>('asc');
  const [studentSearch, setStudentSearch] = useState('');

  // Lessons tab local state
  const [lessonSortBy, setLessonSortBy] = useState<RosterLessonSortBy>('title');
  const [lessonSortDirection, setLessonSortDirection] = useState<SortDirection>('asc');

  // Review tab local state
  const [reviewSortBy, setReviewSortBy] = useState<RosterReviewSortBy>('name');
  const [reviewSortDirection, setReviewSortDirection] = useState<SortDirection>('asc');

  // Student drill-down
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Queries
  const summaryQuery = useRosterSummaryQuery(parsedId);
  const studentsQuery = useRosterStudentsQuery(parsedId, {
    filter: studentFilter,
    sortBy: studentSortBy,
    sortDirection: studentSortDirection,
    search: studentSearch || undefined,
  });
  const lessonsQuery = useRosterLessonsQuery(parsedId, {
    sortBy: lessonSortBy,
    sortDirection: lessonSortDirection,
  });
  const reviewQuery = useRosterReviewQuery(parsedId, {
    sortBy: reviewSortBy,
    sortDirection: reviewSortDirection,
  });
  const studentDetailQuery = useRosterStudentDetailQuery(parsedId, selectedStudentId);

  // Error logging — only escalate server errors to telemetry
  useEffect(() => {
    if (summaryQuery.error && shouldLogApiError(summaryQuery.error)) {
      logError(summaryQuery.error, { feature: 'roster', action: 'summary', moduleId: parsedId });
    }
  }, [summaryQuery.error, parsedId]);

  useEffect(() => {
    if (studentsQuery.error && shouldLogApiError(studentsQuery.error)) {
      logError(studentsQuery.error, { feature: 'roster', action: 'students', moduleId: parsedId });
    }
  }, [studentsQuery.error, parsedId]);

  useEffect(() => {
    if (lessonsQuery.error && shouldLogApiError(lessonsQuery.error)) {
      logError(lessonsQuery.error, { feature: 'roster', action: 'lessons', moduleId: parsedId });
    }
  }, [lessonsQuery.error, parsedId]);

  useEffect(() => {
    if (reviewQuery.error && shouldLogApiError(reviewQuery.error)) {
      logError(reviewQuery.error, { feature: 'roster', action: 'review', moduleId: parsedId });
    }
  }, [reviewQuery.error, parsedId]);

  useEffect(() => {
    if (studentDetailQuery.error && shouldLogApiError(studentDetailQuery.error)) {
      logError(studentDetailQuery.error, {
        feature: 'roster',
        action: 'student-detail',
        moduleId: parsedId,
        studentId: selectedStudentId,
      });
    }
  }, [studentDetailQuery.error, parsedId, selectedStudentId]);

  // Detail panel helpers
  const openDetail = useCallback((tab: RosterTab) => {
    setIsDetailOpen(true);
    setActiveTab(tab);
  }, []);

  const closeDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedStudentId(null);
  }, []);

  // Card click handlers apply preset filter/sort then open the correct tab
  const handleStudentsEnrolledClick = useCallback(() => {
    setStudentFilter('all');
    setStudentSortBy('name');
    setStudentSortDirection('asc');
    openDetail('students');
  }, [openDetail]);

  const handleActiveLast7DaysClick = useCallback(() => {
    setStudentFilter('active_7d');
    setStudentSortBy('last_activity');
    setStudentSortDirection('desc');
    openDetail('students');
  }, [openDetail]);

  const handleAtRiskClick = useCallback(() => {
    setStudentFilter('at_risk');
    // "Highest risk first" — backend defines the at-risk heuristic; sort by due reviews as a proxy.
    setStudentSortBy('due_review_count');
    setStudentSortDirection('desc');
    openDetail('students');
  }, [openDetail]);

  const handleLessonCoverageClick = useCallback(() => {
    setLessonSortBy('completion_rate');
    setLessonSortDirection('asc');
    openDetail('lessons');
  }, [openDetail]);

  const handleReviewBacklogClick = useCallback(() => {
    setReviewSortBy('overdue_review_count');
    setReviewSortDirection('desc');
    openDetail('review');
  }, [openDetail]);

  const selectStudent = useCallback((studentId: number) => {
    setSelectedStudentId((prev) => (prev === studentId ? null : studentId));
  }, []);

  const clearSelectedStudent = useCallback(() => {
    setSelectedStudentId(null);
  }, []);

  // Derived state
  const isLoading = parsedId !== null && summaryQuery.isPending;

  const pageError = useMemo(() => {
    if (!parsedId) return 'Module not found. Please check the link and try again.';
    if (summaryQuery.error) {
      return getDisplayErrorMessage(summaryQuery.error, {
        fallbackMessage: 'Could not load roster data. Please try again.',
      });
    }
    return null;
  }, [parsedId, summaryQuery.error]);

  return {
    parsedId,
    canViewRoster,
    isLoading,
    pageError,

    summary: summaryQuery.data ?? null,
    isSummaryLoading: parsedId !== null && summaryQuery.isPending,

    isDetailOpen,
    activeTab,
    openDetail,
    closeDetail,
    setActiveTab,

    handleStudentsEnrolledClick,
    handleActiveLast7DaysClick,
    handleAtRiskClick,
    handleLessonCoverageClick,
    handleReviewBacklogClick,

    studentFilter,
    setStudentFilter,
    studentSortBy,
    setStudentSortBy,
    studentSortDirection,
    setStudentSortDirection,
    studentSearch,
    setStudentSearch,
    studentRows: studentsQuery.data?.rows ?? [],
    isStudentsLoading: parsedId !== null && studentsQuery.isPending,
    studentsError: studentsQuery.error
      ? getDisplayErrorMessage(studentsQuery.error, {
          fallbackMessage: 'Could not load student data.',
        })
      : null,

    lessonSortBy,
    setLessonSortBy,
    lessonSortDirection,
    setLessonSortDirection,
    lessonRows: lessonsQuery.data?.rows ?? [],
    isLessonsLoading: parsedId !== null && lessonsQuery.isPending,
    lessonsError: lessonsQuery.error
      ? getDisplayErrorMessage(lessonsQuery.error, {
          fallbackMessage: 'Could not load lesson data.',
        })
      : null,

    reviewSortBy,
    setReviewSortBy,
    reviewSortDirection,
    setReviewSortDirection,
    reviewRows: reviewQuery.data?.rows ?? [],
    isReviewLoading: parsedId !== null && reviewQuery.isPending,
    reviewError: reviewQuery.error
      ? getDisplayErrorMessage(reviewQuery.error, {
          fallbackMessage: 'Could not load review data.',
        })
      : null,

    selectedStudentId,
    selectStudent,
    clearSelectedStudent,
    studentDetail: studentDetailQuery.data,
    isStudentDetailLoading: selectedStudentId !== null && studentDetailQuery.isPending,
    studentDetailError: studentDetailQuery.error
      ? getDisplayErrorMessage(studentDetailQuery.error, {
          fallbackMessage: 'Could not load student details.',
        })
      : null,
  };
}
