// Query hooks for module-scoped roster data: summary cards, student/lesson lists, and student drill-down.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  RosterStudentsQuery,
  RosterLessonsQuery,
  RosterStudentsResponse,
  RosterSummaryResponse,
} from '@scholarxp/api-contracts';
import {
  getRosterSummary,
  getRosterStudents,
  getRosterLessons,
  getRosterStudentDetail,
  getLessonDrilldown,
  removeRosterStudent,
} from '@/Authoring/ModuleRoster/api/roster';
import { queryKeys } from '@/shared/hooks/query-keys';

export function useRosterSummaryQuery(moduleId: number | null) {
  return useQuery({
    queryKey: moduleId ? queryKeys.roster.summary(moduleId) : queryKeys.roster.summary(0),
    queryFn: () => getRosterSummary(moduleId!),
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

export function useRosterStudentsQuery(
  moduleId: number | null,
  query: RosterStudentsQuery = {},
) {
  return useQuery({
    // Include query params so sort/filter/search changes trigger a new fetch.
    queryKey: moduleId
      ? [...queryKeys.roster.students(moduleId), query]
      : [...queryKeys.roster.students(0), query],
    queryFn: () => getRosterStudents(moduleId!, query),
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

export function useRosterLessonsQuery(
  moduleId: number | null,
  query: RosterLessonsQuery = {},
) {
  return useQuery({
    // Include query params so sort/direction changes trigger a new fetch.
    queryKey: moduleId
      ? [...queryKeys.roster.lessons(moduleId), query]
      : [...queryKeys.roster.lessons(0), query],
    queryFn: () => getRosterLessons(moduleId!, query),
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

export function useRosterStudentDetailQuery(
  moduleId: number | null,
  studentId: number | null,
) {
  return useQuery({
    queryKey:
      moduleId && studentId
        ? queryKeys.roster.studentDetail(moduleId, studentId)
        : queryKeys.roster.studentDetail(0, 0),
    queryFn: () => getRosterStudentDetail(moduleId!, studentId!),
    // Only fetch when both ids are present — prevents premature requests before drill-down selection.
    enabled: moduleId !== null && studentId !== null,
    staleTime: 30_000,
  });
}

// Optimistic snapshot used to roll back student/summary caches if the delete request fails.
type RemoveStudentMutationContext = {
  studentSnapshots: Array<[readonly unknown[], RosterStudentsResponse | undefined]>;
  summarySnapshot: RosterSummaryResponse | undefined;
};

// Optimistic update: drop the row from every cached student-list variant (filter/sort permutations)
// and decrement the summary count immediately so the UI reflects the action without waiting for refetch.
// Lesson coverage still requires a server roundtrip — invalidated in onSettled.
export function useRemoveRosterStudentMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof removeRosterStudent>>,
    unknown,
    number,
    RemoveStudentMutationContext
  >({
    mutationFn: (studentId: number) => {
      if (moduleId === null) {
        throw new Error('Missing module id for student removal.');
      }
      return removeRosterStudent(moduleId, studentId);
    },
    onMutate: async (studentId) => {
      if (moduleId === null) {
        return { studentSnapshots: [], summarySnapshot: undefined };
      }

      const studentsKey = queryKeys.roster.students(moduleId);
      const summaryKey = queryKeys.roster.summary(moduleId);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: studentsKey }),
        queryClient.cancelQueries({ queryKey: summaryKey }),
      ]);

      const studentSnapshots = queryClient.getQueriesData<RosterStudentsResponse>({
        queryKey: studentsKey,
      });
      const summarySnapshot = queryClient.getQueryData<RosterSummaryResponse>(summaryKey);

      queryClient.setQueriesData<RosterStudentsResponse>(
        { queryKey: studentsKey },
        (old) => {
          if (!old) return old;
          return { ...old, rows: old.rows.filter((row) => row.studentId !== studentId) };
        },
      );

      if (summarySnapshot) {
        queryClient.setQueryData<RosterSummaryResponse>(summaryKey, {
          ...summarySnapshot,
          studentsEnrolled: Math.max(0, summarySnapshot.studentsEnrolled - 1),
        });
      }

      return { studentSnapshots, summarySnapshot };
    },
    onError: (_error, _studentId, context) => {
      if (moduleId === null || !context) return;
      for (const [key, data] of context.studentSnapshots) {
        queryClient.setQueryData(key, data);
      }
      if (context.summarySnapshot) {
        queryClient.setQueryData(
          queryKeys.roster.summary(moduleId),
          context.summarySnapshot,
        );
      }
    },
    onSettled: async () => {
      if (moduleId === null) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.roster.summary(moduleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roster.students(moduleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roster.lessons(moduleId) }),
      ]);
    },
  });
}

export function useRosterLessonDrilldownQuery(
  moduleId: number | null,
  moduleUnitId: number | null,
) {
  return useQuery({
    queryKey:
      moduleId && moduleUnitId
        ? queryKeys.roster.lessonDrilldown(moduleId, moduleUnitId)
        : queryKeys.roster.lessonDrilldown(0, 0),
    queryFn: () => getLessonDrilldown(moduleId!, moduleUnitId!),
    // Only fetch when a lesson row is selected in the Lessons tab.
    enabled: moduleId !== null && moduleUnitId !== null,
    staleTime: 30_000,
  });
}
