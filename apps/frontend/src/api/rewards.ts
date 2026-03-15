// Rewards API helpers keep frontend reward-track reads aligned with the backend-owned pacing contracts.
import type { DailyLessonXpTrackResponse } from '@scholarxp/api-contracts';
import { apiFetch } from './client';

export async function getDailyLessonXpTrack(): Promise<DailyLessonXpTrackResponse> {
  return apiFetch<DailyLessonXpTrackResponse>('/rewards/daily-lesson-xp-track', {
    method: 'GET',
  });
}
