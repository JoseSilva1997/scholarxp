// Quests API helpers keep the frontend strictly aligned with the shared quest read and trigger contracts.
import type {
  MasterQuestStreakResponse,
  QuestHistoryQuery,
  QuestHistoryResponse,
  QuestProgressResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

export async function listQuests(
  query: QuestHistoryQuery,
): Promise<QuestHistoryResponse> {
  const searchParams = new URLSearchParams();
  if (query.dayLimit !== undefined) {
    searchParams.set('dayLimit', String(query.dayLimit));
  }
  if (query.dayOffset !== undefined) {
    searchParams.set('dayOffset', String(query.dayOffset));
  }

  const queryString = searchParams.toString();
  return apiFetch<QuestHistoryResponse>(
    `/daily-quest/history${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
    },
  );
}

export async function getMasterQuestStreak(): Promise<MasterQuestStreakResponse> {
  return apiFetch<MasterQuestStreakResponse>('/daily-quest/master-streak', {
    method: 'GET',
  });
}

export async function recordDailyRevisionQuestProgress(
  moduleId: number,
): Promise<QuestProgressResponse> {
  return apiFetch<QuestProgressResponse>(
    `/daily-quest/module/${moduleId}/daily-revision-click`,
    {
      method: 'POST',
    },
  );
}

export async function recordCompletedUnitReviewQuestProgress(
  moduleId: number,
  moduleUnitId: number,
): Promise<QuestProgressResponse> {
  return apiFetch<QuestProgressResponse>(
    `/daily-quest/module/${moduleId}/unit/${moduleUnitId}/completed-review`,
    {
      method: 'POST',
    },
  );
}
