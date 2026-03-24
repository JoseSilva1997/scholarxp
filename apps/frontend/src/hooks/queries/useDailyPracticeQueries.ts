// Daily-practice query hooks keep adaptive-session server state out of route components and aligned with shared cache keys.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SubmitDailyPracticeAttemptPayload,
  SubmitDailyPracticeAttemptResponse,
} from '@scholarxp/api-contracts';
import {
  closeDailyPracticeSession,
  getTodayDailyPractice,
  submitDailyPracticeAttempt,
} from '../../api/daily-practice';
import { queryKeys } from '../query-keys';

export function useTodayDailyPracticeQuery(
  moduleId: number | null,
  sessionId: string | null,
) {
  return useQuery({
    queryKey:
      moduleId !== null
        ? queryKeys.modules.dailyPractice(moduleId, sessionId ?? undefined)
        : queryKeys.modules.dailyPractice(0),
    queryFn: () =>
      getTodayDailyPractice(moduleId!, {
        sessionId: sessionId ?? undefined,
      }),
    // Wait until routing has resolved a valid module id before requesting the daily set.
    enabled: moduleId !== null,
    staleTime: 30_000,
  });
}

export function useSubmitDailyPracticeAttemptMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

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

export function useCloseDailyPracticeSessionMutation(moduleId: number | null) {
  return useMutation({
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
