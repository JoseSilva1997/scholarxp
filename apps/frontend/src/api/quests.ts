// Quests API helpers keep the frontend strictly aligned with the shared quest-history contract.
import type { QuestResponse } from '@scholarxp/api-contracts';
import { apiFetch } from './client';

export async function listQuests(): Promise<QuestResponse> {
  return apiFetch<QuestResponse>('/daily-quest/history', {
    method: 'GET',
  });
}
