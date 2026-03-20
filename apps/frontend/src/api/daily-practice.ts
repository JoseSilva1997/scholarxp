// Daily-practice API helpers keep the frontend aligned with the shared adaptive-session transport contracts.
import type {
  CloseDailyPracticeSessionResponse,
  GetTodayDailyPracticeQuery,
  DailyPracticeTodayResponse,
  SubmitDailyPracticeAttemptPayload,
  SubmitDailyPracticeAttemptResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from './client';

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
