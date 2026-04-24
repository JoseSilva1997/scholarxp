// Daily XP track query hooks centralize server-state wiring for the header's pacing widget so render components stay lean.
import { useQuery } from '@tanstack/react-query';
import type { DailyLessonXpTrackResponse } from '@scholarxp/api-contracts';
import { getDailyLessonXpTrack } from '@/shared/api/daily-xp-track';
import { queryKeys } from '@/shared/hooks/query-keys';

export function useDailyLessonXpTrackQuery(enabled: boolean, userId?: number) {
  return useQuery<DailyLessonXpTrackResponse>({
    queryKey: queryKeys.rewards.dailyLessonXpTrack(userId ?? null),
    queryFn: getDailyLessonXpTrack,
    // Header reads should wait for auth bootstrap so anonymous shells do not trigger reward fetches.
    enabled,
    staleTime: 30_000,
  });
}
