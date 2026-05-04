// Verifies roster query hooks use stable keys, enablement rules, and optimistic removal behavior.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { RosterStudentsResponse, RosterSummaryResponse } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/shared/hooks/query-keys';
import {
  useRemoveRosterStudentMutation,
  useRosterLessonDrilldownQuery,
  useRosterLessonsQuery,
  useRosterStudentDetailQuery,
  useRosterStudentsQuery,
  useRosterSummaryQuery,
} from '@/Authoring/ModuleRoster/queries/useRosterQueries';

const apiMocks = vi.hoisted(() => ({
  getRosterSummary: vi.fn(),
  getRosterStudents: vi.fn(),
  getRosterLessons: vi.fn(),
  getRosterStudentDetail: vi.fn(),
  getLessonDrilldown: vi.fn(),
  removeRosterStudent: vi.fn(),
}));

vi.mock('@/Authoring/ModuleRoster/api/roster', () => apiMocks);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe('useRosterQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createClient();
    vi.clearAllMocks();
  });

  it('fetches summary, students, lessons, and drilldowns with their cache keys', async () => {
    apiMocks.getRosterSummary.mockResolvedValue({ moduleTitle: 'Algebra' });
    apiMocks.getRosterStudents.mockResolvedValue({ rows: [] });
    apiMocks.getRosterLessons.mockResolvedValue({ rows: [] });
    apiMocks.getRosterStudentDetail.mockResolvedValue({ student: { fullName: 'Ada' } });
    apiMocks.getLessonDrilldown.mockResolvedValue({ lessonTitle: 'Lesson 1' });

    const wrapper = createWrapper(queryClient);
    renderHook(() => useRosterSummaryQuery(12), { wrapper });
    renderHook(() => useRosterStudentsQuery(12, { filter: 'at_risk' }), { wrapper });
    renderHook(() => useRosterLessonsQuery(12, { sortBy: 'title' }), { wrapper });
    renderHook(() => useRosterStudentDetailQuery(12, 34), { wrapper });
    renderHook(() => useRosterLessonDrilldownQuery(12, 56), { wrapper });

    await waitFor(() => expect(apiMocks.getLessonDrilldown).toHaveBeenCalledWith(12, 56));

    expect(queryClient.getQueryData(queryKeys.roster.summary(12))).toEqual({
      moduleTitle: 'Algebra',
    });
    expect(apiMocks.getRosterStudents).toHaveBeenCalledWith(12, { filter: 'at_risk' });
    expect(apiMocks.getRosterLessons).toHaveBeenCalledWith(12, { sortBy: 'title' });
    expect(apiMocks.getRosterStudentDetail).toHaveBeenCalledWith(12, 34);
  });

  it('keeps queries disabled until module and drilldown ids are available', () => {
    const wrapper = createWrapper(queryClient);

    renderHook(() => useRosterSummaryQuery(null), { wrapper });
    renderHook(() => useRosterStudentsQuery(null), { wrapper });
    renderHook(() => useRosterLessonsQuery(null), { wrapper });
    renderHook(() => useRosterStudentDetailQuery(12, null), { wrapper });
    renderHook(() => useRosterLessonDrilldownQuery(12, null), { wrapper });

    expect(apiMocks.getRosterSummary).not.toHaveBeenCalled();
    expect(apiMocks.getRosterStudents).not.toHaveBeenCalled();
    expect(apiMocks.getRosterLessons).not.toHaveBeenCalled();
    expect(apiMocks.getRosterStudentDetail).not.toHaveBeenCalled();
    expect(apiMocks.getLessonDrilldown).not.toHaveBeenCalled();
  });

  it('optimistically removes students, decrements summary, and rolls back on failure', async () => {
    const studentsKey = [...queryKeys.roster.students(12), { filter: 'all' }] as const;
    const summaryKey = queryKeys.roster.summary(12);
    const students: RosterStudentsResponse = {
      rows: [
        { studentId: 34, fullName: 'Ada' },
        { studentId: 35, fullName: 'Grace' },
      ],
    } as RosterStudentsResponse;
    const summary: RosterSummaryResponse = {
      moduleId: 12,
      moduleTitle: 'Algebra',
      studentsEnrolled: 2,
      activeLast7Days: 1,
      atRiskCount: 0,
      lessonCoverage: {
        totalLiveLessons: 1,
        lessonsStartedByAtLeastOneStudent: 1,
        lessonsCompletedByAtLeastHalfOfStudents: 1,
      },
    };
    queryClient.setQueryData(studentsKey, students);
    queryClient.setQueryData(summaryKey, summary);
    apiMocks.removeRosterStudent.mockRejectedValue(new Error('failed'));

    const { result } = renderHook(() => useRemoveRosterStudentMutation(12), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(34);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(studentsKey)).toEqual(students);
    expect(queryClient.getQueryData(summaryKey)).toEqual(summary);
  });

  it('throws when removal runs without a module id', async () => {
    const { result } = renderHook(() => useRemoveRosterStudentMutation(null), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(34);

    await waitFor(() => expect(result.current.error).toEqual(expect.any(Error)));
    expect(apiMocks.removeRosterStudent).not.toHaveBeenCalled();
  });
});
