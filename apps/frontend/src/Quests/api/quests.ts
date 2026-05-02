// Provides the Quests module's repository-style API boundary for history reads and progress triggers.
import type {
  MasterQuestStreakResponse,
  QuestHistoryQuery,
  QuestHistoryResponse,
  QuestProgressResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

// Fetches quest-history pages using backend day-window pagination parameters.
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

  // Optional parameters are omitted rather than serialized as empty values so the backend can apply defaults.
  return apiFetch<QuestHistoryResponse>(
    `/daily-quest/history${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
    },
  );
}

// Retrieves the user's current master-quest streak for global and page-level quest summaries.
export async function getMasterQuestStreak(): Promise<MasterQuestStreakResponse> {
  return apiFetch<MasterQuestStreakResponse>('/daily-quest/master-streak', {
    method: 'GET',
  });
}

// Records that the user engaged with the daily revision quest for a module.
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

// Records quest progress when a module unit has been reviewed to completion.
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
