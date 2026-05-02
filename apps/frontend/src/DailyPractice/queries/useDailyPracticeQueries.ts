// Daily-practice query hooks form a React Query cache-adapter layer for adaptive-session server state.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SubmitDailyPracticeAttemptPayload,
  SubmitDailyPracticeAttemptResponse,
} from '@scholarxp/api-contracts';
import {
  closeDailyPracticeSession,
  getTodayDailyPractice,
  submitDailyPracticeAttempt,
} from '@/DailyPractice/api/daily-practice';
import { queryKeys } from '@/shared/hooks/query-keys';

// React Query adapter for loading or resuming today's adaptive Daily Practice set.
export function useTodayDailyPracticeQuery(
  moduleId: number | null,
  sessionId: string | null,
) {
  return useQuery({
    queryKey:
      moduleId !== null
        ? queryKeys.modules.dailyPractice(moduleId, sessionId ?? undefined)
        : queryKeys.modules.dailyPractice(0),
    // Query hooks act as a cache facade: components depend on stable keys rather than transport details.
    queryFn: () =>
      getTodayDailyPractice(moduleId!, {
        sessionId: sessionId ?? undefined,
      }),
    // Wait until routing has resolved a valid module id before requesting the daily set.
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

// Mutation hook for attempt submission plus the cross-feature cache refreshes triggered by a successful grade.
export function useSubmitDailyPracticeAttemptMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  // Centralizes post-submit invalidation so the page-state hook can remain focused on local UI updates.
  const syncAttemptSuccessEffects = async (
    data: SubmitDailyPracticeAttemptResponse,
  ) => {
    if (moduleId === null) {
      return;
    }

    // Keep the signature aligned with the practice-room hook contract even though v1 does not branch on response payload fields yet.
    void data;

    // Daily practice can complete quests and award account-level rewards, so dependent summaries must refresh together.
    // Invalidate the module detail so the embedded dailyPractice status reflects the latest progress.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.modules.detail(moduleId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.quests.all,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.rewards.dailyLessonXpTrackAll,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.me,
      }),
    ]);
  };

  const mutation = useMutation({
    // Submits a learner answer through the daily-practice API while guarding against invalid route state.
    mutationFn: (payload: SubmitDailyPracticeAttemptPayload) => {
      if (moduleId === null) {
        throw new Error(
          'Cannot submit a daily-practice attempt without a valid module id.',
        );
      }

      return submitDailyPracticeAttempt(moduleId, payload);
    },
  });

  return {
    ...mutation,
    syncAttemptSuccessEffects,
  };
}

// Mutation hook for closing a Daily Practice session when the route or browser lifecycle ends.
export function useCloseDailyPracticeSessionMutation(moduleId: number | null) {
  return useMutation({
    // Session close is intentionally explicit so the backend can finalize session analytics independently of answer submission.
    mutationFn: (sessionId: string) => {
      if (moduleId === null) {
        throw new Error(
          'Cannot close a daily-practice session without a valid module id.',
        );
      }

      return closeDailyPracticeSession(moduleId, sessionId);
    },
  });
}
