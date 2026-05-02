// Roster API client: module-scoped tutor analytics for enrollment, lesson coverage, and per-student metrics.
import type {
  LessonDrilldownResponse,
  RemoveRosterStudentResponse,
  RosterSummaryResponse,
  RosterStudentsQuery,
  RosterStudentsResponse,
  RosterLessonsQuery,
  RosterLessonsResponse,
  RosterStudentDetailResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

// Retrieves high-level roster metrics used by the summary cards and tab shortcuts.
export async function getRosterSummary(moduleId: number): Promise<RosterSummaryResponse> {
  return apiFetch<RosterSummaryResponse>(`/module/${moduleId}/roster/summary`, {
    method: 'GET',
  });
}

// Filtering and sorting happen server-side to keep pagination viable in future.
export async function getRosterStudents(
  moduleId: number,
  query: RosterStudentsQuery = {},
): Promise<RosterStudentsResponse> {
  const params = new URLSearchParams();
  if (query.filter) params.set('filter', query.filter);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortDirection) params.set('sortDirection', query.sortDirection);
  if (query.search) params.set('search', query.search);
  const qs = params.toString();
  return apiFetch<RosterStudentsResponse>(
    `/module/${moduleId}/roster/students${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

// Retrieves lesson-level roster analytics for tutor scanning and lesson drilldown entry.
export async function getRosterLessons(
  moduleId: number,
  query: RosterLessonsQuery = {},
): Promise<RosterLessonsResponse> {
  const params = new URLSearchParams();
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortDirection) params.set('sortDirection', query.sortDirection);
  const qs = params.toString();
  return apiFetch<RosterLessonsResponse>(
    `/module/${moduleId}/roster/lessons${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

// Retrieves one student's module progress detail for the side-panel drilldown.
export async function getRosterStudentDetail(
  moduleId: number,
  studentId: number,
): Promise<RosterStudentDetailResponse> {
  return apiFetch<RosterStudentDetailResponse>(
    `/module/${moduleId}/roster/students/${studentId}`,
    { method: 'GET' },
  );
}

// Removes a student enrollment from a module after tutor confirmation.
export async function removeRosterStudent(
  moduleId: number,
  studentId: number,
): Promise<RemoveRosterStudentResponse> {
  return apiFetch<RemoveRosterStudentResponse>(
    `/module/${moduleId}/roster/students/${studentId}`,
    { method: 'DELETE' },
  );
}

// Retrieves per-question lesson diagnostics that help tutors identify weak content.
export async function getLessonDrilldown(
  moduleId: number,
  moduleUnitId: number,
): Promise<LessonDrilldownResponse> {
  return apiFetch<LessonDrilldownResponse>(
    `/module/${moduleId}/roster/lessons/${moduleUnitId}`,
    { method: 'GET' },
  );
}
