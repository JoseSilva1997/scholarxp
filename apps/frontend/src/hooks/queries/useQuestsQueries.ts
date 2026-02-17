// Quests query hooks keep server-state fetch behavior centralized and cache-keyed consistently.
import { useQuery } from '@tanstack/react-query';
import type { QuestResponse } from '@scholarxp/api-contracts';
import { listQuests } from '../../api/quests';
import { queryKeys } from '../query-keys';

export function useQuestHistoryQuery(enabled: boolean) {
  return useQuery<QuestResponse>({
    queryKey: queryKeys.quests.history,
    queryFn: listQuests,
    // Gate requests until auth bootstrap is complete to avoid noisy unauthorized fetches.
    enabled,
    staleTime: 30_000,
  });
}
