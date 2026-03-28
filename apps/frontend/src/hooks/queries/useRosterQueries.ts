// Query hooks for module-scoped roster data: summary cards, student/lesson/review lists, and student drill-down.
import { useQuery } from '@tanstack/react-query';
import type {
  RosterStudentsQuery,
  RosterLessonsQuery,
  RosterReviewQuery,
} from '@scholarxp/api-contracts';
import {
  getRosterSummary,
  getRosterStudents,
  getRosterLessons,
  getRosterReview,
  getRosterStudentDetail,
} from '../../api/roster';
import { queryKeys } from '../query-keys';

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
    queryKey: moduleId ? queryKeys.roster.students(moduleId) : queryKeys.roster.students(0),
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
    queryKey: moduleId ? queryKeys.roster.lessons(moduleId) : queryKeys.roster.lessons(0),
    queryFn: () => getRosterLessons(moduleId!, query),
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

export function useRosterReviewQuery(
  moduleId: number | null,
  query: RosterReviewQuery = {},
) {
  return useQuery({
    queryKey: moduleId ? queryKeys.roster.review(moduleId) : queryKeys.roster.review(0),
    queryFn: () => getRosterReview(moduleId!, query),
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
