// Verifies roster page state parses route ids, derives tabs/filters, and coordinates removal flow.
import { act, renderHook } from '@testing-library/react';
import type { AuthUser, RosterStudentRow } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModuleRosterPageState } from '@/Authoring/ModuleRoster/page-state/useModuleRosterPageState';
import {
  useRemoveRosterStudentMutation,
  useRosterLessonDrilldownQuery,
  useRosterLessonsQuery,
  useRosterStudentDetailQuery,
  useRosterStudentsQuery,
  useRosterSummaryQuery,
} from '@/Authoring/ModuleRoster/queries/useRosterQueries';
import { canUserAccess } from '@/shared/permissions/permission';

vi.mock('@/Authoring/ModuleRoster/queries/useRosterQueries', () => ({
  useRosterSummaryQuery: vi.fn(),
  useRosterStudentsQuery: vi.fn(),
  useRosterLessonsQuery: vi.fn(),
  useRosterStudentDetailQuery: vi.fn(),
  useRosterLessonDrilldownQuery: vi.fn(),
  useRemoveRosterStudentMutation: vi.fn(),
}));

vi.mock('@/shared/permissions/permission', () => ({
  canUserAccess: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logError: vi.fn(),
}));

function buildUser(): AuthUser {
  return {
    id: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    profilePictureUrl: '',
    globalRole: 'teacher',
    isVerified: true,
    timezone: 'UTC',
    avatar: null,
  };
}

const studentRow = {
  studentId: 34,
  fullName: 'Ada Student',
  avatarUrl: '',
} as RosterStudentRow;

describe('useModuleRosterPageState', () => {
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canUserAccess).mockReturnValue(true);
    vi.mocked(useRosterSummaryQuery).mockReturnValue({
      isPending: false,
      data: {
        moduleId: 12,
        moduleTitle: 'Algebra',
        studentsEnrolled: 1,
        activeLast7Days: 1,
        atRiskCount: 0,
        lessonCoverage: {
          totalLiveLessons: 1,
          lessonsStartedByAtLeastOneStudent: 1,
          lessonsCompletedByAtLeastHalfOfStudents: 1,
        },
      },
      error: null,
    } as never);
    vi.mocked(useRosterStudentsQuery).mockReturnValue({
      isPending: false,
      data: { rows: [studentRow] },
      error: null,
    } as never);
    vi.mocked(useRosterLessonsQuery).mockReturnValue({
      isPending: false,
      data: { rows: [{ moduleUnitId: 55, title: 'Lesson 1' }] },
      error: null,
    } as never);
    vi.mocked(useRosterStudentDetailQuery).mockReturnValue({
      isPending: false,
      data: { student: { fullName: 'Ada Student' } },
      error: null,
    } as never);
    vi.mocked(useRosterLessonDrilldownQuery).mockReturnValue({
      isPending: false,
      data: { lessonTitle: 'Lesson 1' },
      error: null,
    } as never);
    vi.mocked(useRemoveRosterStudentMutation).mockReturnValue({
      mutate,
      isPending: false,
    } as never);
  });

  it('parses module id and exposes roster data when the user can view it', () => {
    const { result } = renderHook(() =>
      useModuleRosterPageState({ moduleIdParam: '12', user: buildUser() }),
    );

    expect(result.current.parsedId).toBe(12);
    expect(result.current.canViewRoster).toBe(true);
    expect(result.current.summary?.moduleTitle).toBe('Algebra');
    expect(result.current.studentRows).toEqual([studentRow]);
    expect(result.current.lessonRows).toEqual([{ moduleUnitId: 55, title: 'Lesson 1' }]);
  });

  it('reports invalid module ids as a page error', () => {
    const { result } = renderHook(() =>
      useModuleRosterPageState({ moduleIdParam: 'bad', user: buildUser() }),
    );

    expect(result.current.parsedId).toBeNull();
    expect(result.current.pageError).toBe('Module not found. Please check the link and try again.');
  });

  it('card shortcuts set the expected tab, filters, and sort state', () => {
    const { result } = renderHook(() =>
      useModuleRosterPageState({ moduleIdParam: '12', user: buildUser() }),
    );

    act(() => result.current.handleActiveLast7DaysClick());
    expect(result.current.activeTab).toBe('students');
    expect(result.current.studentFilter).toBe('active_7d');
    expect(result.current.studentSortBy).toBe('last_activity');
    expect(result.current.studentSortDirection).toBe('desc');

    act(() => result.current.handleLessonCoverageClick());
    expect(result.current.activeTab).toBe('lessons');
    expect(result.current.lessonSortBy).toBe('completion_rate');
  });

  it('toggles selected student and lesson drilldowns exclusively', () => {
    const { result } = renderHook(() =>
      useModuleRosterPageState({ moduleIdParam: '12', user: buildUser() }),
    );

    act(() => result.current.selectStudent(34));
    expect(result.current.selectedStudentId).toBe(34);
    expect(result.current.selectedLessonId).toBeNull();

    act(() => result.current.selectLesson(55));
    expect(result.current.selectedLessonId).toBe(55);
    expect(result.current.selectedStudentId).toBeNull();

    act(() => result.current.selectLesson(55));
    expect(result.current.selectedLessonId).toBeNull();
  });

  it('coordinates remove-student success and error callbacks', () => {
    mutate.mockImplementation((_studentId: number, options: { onSuccess: () => void }) => {
      options.onSuccess();
    });
    const { result } = renderHook(() =>
      useModuleRosterPageState({ moduleIdParam: '12', user: buildUser() }),
    );

    act(() => result.current.requestRemoveStudent(studentRow));
    expect(result.current.studentPendingRemoval).toBe(studentRow);

    act(() => result.current.confirmRemoveStudent());
    expect(mutate).toHaveBeenCalledWith(34, expect.objectContaining({ onSuccess: expect.any(Function) }));
    expect(result.current.studentPendingRemoval).toBeNull();

    mutate.mockImplementation((_studentId: number, options: { onError: (error: unknown) => void }) => {
      options.onError(new Error('failed'));
    });
    act(() => result.current.requestRemoveStudent(studentRow));
    act(() => result.current.confirmRemoveStudent());

    expect(result.current.removeStudentError).toBe('Could not remove the student. Please try again.');
  });

  it('prevents cancelling removal while mutation is pending', () => {
    vi.mocked(useRemoveRosterStudentMutation).mockReturnValue({
      mutate,
      isPending: true,
    } as never);
    const { result } = renderHook(() =>
      useModuleRosterPageState({ moduleIdParam: '12', user: buildUser() }),
    );

    act(() => result.current.requestRemoveStudent(studentRow));
    act(() => result.current.cancelRemoveStudent());

    expect(result.current.studentPendingRemoval).toBe(studentRow);
  });

  it('exposes loading and display errors from all roster queries', () => {
    vi.mocked(useRosterSummaryQuery).mockReturnValue({
      isPending: true,
      data: undefined,
      error: new Error('summary failed'),
    } as never);
    vi.mocked(useRosterStudentsQuery).mockReturnValue({
      isPending: true,
      data: undefined,
      error: new Error('students failed'),
    } as never);
    vi.mocked(useRosterLessonsQuery).mockReturnValue({
      isPending: true,
      data: undefined,
      error: new Error('lessons failed'),
    } as never);
    vi.mocked(useRosterStudentDetailQuery).mockReturnValue({
      isPending: true,
      data: undefined,
      error: new Error('detail failed'),
    } as never);
    vi.mocked(useRosterLessonDrilldownQuery).mockReturnValue({
      isPending: true,
      data: undefined,
      error: new Error('drilldown failed'),
    } as never);

    const { result } = renderHook(() =>
      useModuleRosterPageState({ moduleIdParam: '12', user: buildUser() }),
    );

    act(() => result.current.selectStudent(34));
    act(() => result.current.selectLesson(55));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.pageError).toBe('Could not load roster data. Please try again.');
    expect(result.current.studentsError).toBe('Could not load student data.');
    expect(result.current.lessonsError).toBe('Could not load lesson data.');
    expect(result.current.studentDetailError).toBe('Could not load student details.');
    expect(result.current.lessonDrilldownError).toBe('Could not load lesson details.');
  });

  it('covers remaining shortcuts, clearers, permission false, and no pending removal', () => {
    vi.mocked(canUserAccess).mockReturnValue(false);
    const { result } = renderHook(() =>
      useModuleRosterPageState({ moduleIdParam: '12', user: buildUser() }),
    );

    expect(result.current.canViewRoster).toBe(false);
    expect(result.current.canRemoveStudents).toBe(false);

    act(() => result.current.handleStudentsEnrolledClick());
    expect(result.current.studentFilter).toBe('all');
    expect(result.current.studentSortBy).toBe('name');
    expect(result.current.studentSortDirection).toBe('asc');

    act(() => result.current.handleAtRiskClick());
    expect(result.current.studentFilter).toBe('at_risk');
    expect(result.current.studentSortDirection).toBe('asc');

    act(() => result.current.selectStudent(34));
    act(() => result.current.selectStudent(34));
    expect(result.current.selectedStudentId).toBeNull();

    act(() => result.current.selectStudent(34));
    act(() => result.current.clearSelectedStudent());
    expect(result.current.selectedStudentId).toBeNull();

    act(() => result.current.selectLesson(null));
    expect(result.current.selectedLessonId).toBeNull();

    act(() => result.current.confirmRemoveStudent());
    expect(mutate).not.toHaveBeenCalled();

    act(() => result.current.requestRemoveStudent(studentRow));
    act(() => result.current.cancelRemoveStudent());
    expect(result.current.studentPendingRemoval).toBeNull();
  });
});
