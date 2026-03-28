// Roster API client: module-scoped tutor analytics for enrollment, lesson coverage, and review health.
import type {
  RosterSummaryResponse,
  RosterStudentsQuery,
  RosterStudentsResponse,
  RosterLessonsQuery,
  RosterLessonsResponse,
  RosterReviewQuery,
  RosterReviewResponse,
  RosterStudentDetailResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from './client';

// Backend pass 2: GET /module/:moduleId/roster/summary
// Must aggregate enrollment count, 7-day active count, at-risk count (backend-defined heuristic),
// lesson coverage stats across all live units, and overdue review totals from FSRS state.
export async function getRosterSummary(moduleId: number): Promise<RosterSummaryResponse> {
  return apiFetch<RosterSummaryResponse>(`/module/${moduleId}/roster/summary`, {
    method: 'GET',
  });
}

// Backend pass 2: GET /module/:moduleId/roster/students
// Must return one row per enrolled student with server-computed fields (averageMastery, isAtRisk, dailyPracticeStatus).
// Filtering and sorting should happen server-side to keep pagination viable in future.
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

// Backend pass 2: GET /module/:moduleId/roster/lessons
// Must return one row per live lesson with aggregated student start/complete counts and average mastery.
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

// Backend pass 2: GET /module/:moduleId/roster/review
// Must return one row per enrolled student with FSRS-derived due/overdue counts and daily practice status.
export async function getRosterReview(
  moduleId: number,
  query: RosterReviewQuery = {},
): Promise<RosterReviewResponse> {
  const params = new URLSearchParams();
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortDirection) params.set('sortDirection', query.sortDirection);
  const qs = params.toString();
  return apiFetch<RosterReviewResponse>(
    `/module/${moduleId}/roster/review${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

// Backend pass 2: GET /module/:moduleId/roster/students/:studentId
// Must return full student detail including per-lesson progress, FSRS review state, and 7-day performance snapshot.
export async function getRosterStudentDetail(
  moduleId: number,
  studentId: number,
): Promise<RosterStudentDetailResponse> {
  return apiFetch<RosterStudentDetailResponse>(
    `/module/${moduleId}/roster/students/${studentId}`,
    { method: 'GET' },
  );
}
