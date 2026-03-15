// Reward query hooks centralize server-state wiring for standalone reward-track widgets so header components stay render-focused.
import { useQuery } from '@tanstack/react-query';
import type { DailyLessonXpTrackResponse } from '@scholarxp/api-contracts';
import { getDailyLessonXpTrack } from '@/api/rewards';
import { queryKeys } from '../query-keys';

export function useDailyLessonXpTrackQuery(enabled: boolean, userId?: number) {
  return useQuery<DailyLessonXpTrackResponse>({
    queryKey: queryKeys.rewards.dailyLessonXpTrack(userId ?? null),
    queryFn: getDailyLessonXpTrack,
    // Header reads should wait for auth bootstrap so anonymous shells do not trigger reward fetches.
    enabled,
    staleTime: 30_000,
  });
}
