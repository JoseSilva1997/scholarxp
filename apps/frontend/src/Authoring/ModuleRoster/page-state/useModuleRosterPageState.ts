// Orchestrates roster page state: summary cards, detail panel expansion, tab/filter/sort selection, and roster drill-downs.
import { useEffect, useMemo, useState, useCallback } from 'react';
import type {
  AuthUser,
  RosterStudentFilter,
  RosterStudentSortBy,
  RosterLessonSortBy,
  SortDirection,
  RosterSummaryResponse,
  RosterStudentRow,
  RosterLessonRow,
} from '@scholarxp/api-contracts';
import { features } from '@scholarxp/permissions';
import { canUserAccess } from '@/shared/permissions/permission';
import {
  useRosterSummaryQuery,
  useRosterStudentsQuery,
  useRosterLessonsQuery,
  useRosterStudentDetailQuery,
  useRosterLessonDrilldownQuery,
} from '@/Authoring/ModuleRoster/queries/useRosterQueries';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '@/shared/api/get-display-error';
import { logError } from '@/utils/logger';

export type RosterTab = 'students' | 'lessons';

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
  activeTab: RosterTab;
  setActiveTab: (tab: RosterTab) => void;

  // Card click handlers — each opens the detail panel with a preset tab/filter/sort
  handleStudentsEnrolledClick: () => void;
  handleActiveLast7DaysClick: () => void;
  handleAtRiskClick: () => void;
  handleLessonCoverageClick: () => void;

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

  // Student drill-down
  selectedStudentId: number | null;
  selectStudent: (studentId: number) => void;
  clearSelectedStudent: () => void;
  studentDetail: ReturnType<typeof useRosterStudentDetailQuery>['data'] | undefined;
  isStudentDetailLoading: boolean;
  studentDetailError: string | null;

  // Lesson drill-down
  selectedLessonId: number | null;
  selectLesson: (lessonId: number | null) => void;
  lessonDrilldown: ReturnType<typeof useRosterLessonDrilldownQuery>['data'] | undefined;
  isLessonDrilldownLoading: boolean;
  lessonDrilldownError: string | null;
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

  // Detail panel state stays mounted so the roster always has a visible working area.
  const [activeTab, setActiveTab] = useState<RosterTab>('students');

  // Students tab local state
  const [studentFilter, setStudentFilter] = useState<RosterStudentFilter>('all');
  const [studentSortBy, setStudentSortBy] = useState<RosterStudentSortBy>('name');
  const [studentSortDirection, setStudentSortDirection] = useState<SortDirection>('asc');
  const [studentSearch, setStudentSearch] = useState('');

  // Lessons tab local state
  const [lessonSortBy, setLessonSortBy] = useState<RosterLessonSortBy>('title');
  const [lessonSortDirection, setLessonSortDirection] = useState<SortDirection>('asc');

  // Student drill-down
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Lesson drill-down
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

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
  const studentDetailQuery = useRosterStudentDetailQuery(parsedId, selectedStudentId);
  const lessonDrilldownQuery = useRosterLessonDrilldownQuery(parsedId, selectedLessonId);

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
    if (studentDetailQuery.error && shouldLogApiError(studentDetailQuery.error)) {
      logError(studentDetailQuery.error, {
        feature: 'roster',
        action: 'student-detail',
        moduleId: parsedId,
        studentId: selectedStudentId,
      });
    }
  }, [studentDetailQuery.error, parsedId, selectedStudentId]);

  useEffect(() => {
    if (lessonDrilldownQuery.error && shouldLogApiError(lessonDrilldownQuery.error)) {
      logError(lessonDrilldownQuery.error, {
        feature: 'roster',
        action: 'lesson-drilldown',
        moduleId: parsedId,
        moduleUnitId: selectedLessonId,
      });
    }
  }, [lessonDrilldownQuery.error, parsedId, selectedLessonId]);

  // Card click handlers apply preset filter/sort then open the correct tab
  const handleStudentsEnrolledClick = useCallback(() => {
    setStudentFilter('all');
    setStudentSortBy('name');
    setStudentSortDirection('asc');
    setActiveTab('students');
  }, []);

  const handleActiveLast7DaysClick = useCallback(() => {
    setStudentFilter('active_7d');
    setStudentSortBy('last_activity');
    setStudentSortDirection('desc');
    setActiveTab('students');
  }, []);

  const handleAtRiskClick = useCallback(() => {
    setStudentFilter('at_risk');
    setStudentSortBy('last_activity');
    setStudentSortDirection('asc');
    setActiveTab('students');
  }, []);

  const handleLessonCoverageClick = useCallback(() => {
    setLessonSortBy('completion_rate');
    setLessonSortDirection('asc');
    setActiveTab('lessons');
  }, []);

  const selectStudent = useCallback((studentId: number) => {
    setSelectedStudentId((prev) => (prev === studentId ? null : studentId));
    setSelectedLessonId(null);
  }, []);

  const clearSelectedStudent = useCallback(() => {
    setSelectedStudentId(null);
  }, []);

  const selectLesson = useCallback((lessonId: number | null) => {
    setSelectedLessonId((prev) => {
      if (lessonId === null) return null;
      return prev === lessonId ? null : lessonId;
    });
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

    activeTab,
    setActiveTab,

    handleStudentsEnrolledClick,
    handleActiveLast7DaysClick,
    handleAtRiskClick,
    handleLessonCoverageClick,

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

    selectedLessonId,
    selectLesson,
    lessonDrilldown: lessonDrilldownQuery.data,
    isLessonDrilldownLoading: selectedLessonId !== null && lessonDrilldownQuery.isPending,
    lessonDrilldownError: lessonDrilldownQuery.error
      ? getDisplayErrorMessage(lessonDrilldownQuery.error, {
          fallbackMessage: 'Could not load lesson details.',
        })
      : null,
  };
}
