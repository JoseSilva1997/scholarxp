// Quests API helpers keep the frontend strictly aligned with the shared quest-history contract.
import type {
  QuestHistoryQuery,
  QuestHistoryResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from './client';

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