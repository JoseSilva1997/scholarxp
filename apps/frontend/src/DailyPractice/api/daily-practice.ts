// Repository-style Daily Practice API helpers keep the frontend aligned with shared adaptive-session transport contracts.
import type {
  CloseDailyPracticeSessionResponse,
  GetTodayDailyPracticeQuery,
  DailyPracticeTodayResponse,
  SubmitDailyPracticeAttemptPayload,
  SubmitDailyPracticeAttemptResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

// Data-access helper for fetching today's Daily Practice set, optionally resuming a specific session.
export async function getTodayDailyPractice(
  moduleId: number,
  query: GetTodayDailyPracticeQuery = {},
): Promise<DailyPracticeTodayResponse> {
  const searchParams = new URLSearchParams();
  if (query.sessionId !== undefined) {
    // Session id in query allows resumed daily-practice rooms to stay pinned to the intended backend session.
    searchParams.set('sessionId', query.sessionId);
  }

  const queryString = searchParams.toString();
  return apiFetch<DailyPracticeTodayResponse>(
    `/module/${moduleId}/daily-practice/today${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
    },
  );
}

// Data-access helper for posting a learner attempt to the Daily Practice grading endpoint.
export async function submitDailyPracticeAttempt(
  moduleId: number,
  payload: SubmitDailyPracticeAttemptPayload,
): Promise<SubmitDailyPracticeAttemptResponse> {
  return apiFetch<SubmitDailyPracticeAttemptResponse>(
    `/module/${moduleId}/daily-practice/attempts`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

// Data-access helper for explicitly closing a Daily Practice session once the learner leaves the route.
export async function closeDailyPracticeSession(
  moduleId: number,
  sessionId: string,
): Promise<CloseDailyPracticeSessionResponse> {
  return apiFetch<CloseDailyPracticeSessionResponse>(
    `/module/${moduleId}/daily-practice/session/${sessionId}/close`,
    {
      method: 'POST',
    },
  );
}
