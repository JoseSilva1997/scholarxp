// Quests query hooks keep server-state fetch behavior centralized and cache-keyed consistently.
import { useInfiniteQuery } from '@tanstack/react-query';
import type { QuestHistoryResponse } from '@scholarxp/api-contracts';
import { listQuests } from '../../api/quests';
import { queryKeys } from '../query-keys';

export function useQuestHistoryInfiniteQuery(enabled: boolean, dayLimit: number) {
  return useInfiniteQuery<QuestHistoryResponse>({
    queryKey: queryKeys.quests.history(dayLimit),
    queryFn: ({ pageParam }) =>
      listQuests({
        dayLimit,
        dayOffset: Number(pageParam),
      }),
    // Day offset drives server-side day-window pagination; initial page starts at offset zero.
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      return lastPage.nextDayOffset ?? undefined;
    },
    // Gate requests until auth bootstrap is complete to avoid noisy unauthorized fetches.
    enabled,
    staleTime: 30_000,
  });
}
