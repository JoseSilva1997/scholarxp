// Daily XP track API helper; isolated from cosmetic rewards since this endpoint serves the header pacing widget, not cosmetics.
import type { DailyLessonXpTrackResponse } from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

// Fetches the current user's daily lesson XP track for progress pacing UI.
export async function getDailyLessonXpTrack(): Promise<DailyLessonXpTrackResponse> {
  return apiFetch<DailyLessonXpTrackResponse>('/rewards/daily-lesson-xp-track', {
    method: 'GET',
  });
}
