// Query hooks for module-scoped roster data: summary cards, student/lesson lists, and student drill-down.
import { useQuery } from '@tanstack/react-query';
import type {
  RosterStudentsQuery,
  RosterLessonsQuery,
} from '@scholarxp/api-contracts';
import {
  getRosterSummary,
  getRosterStudents,
  getRosterLessons,
  getRosterStudentDetail,
  getLessonDrilldown,
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
