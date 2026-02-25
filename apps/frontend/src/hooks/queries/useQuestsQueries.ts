// Quests query hooks keep server-state fetch behavior centralized and cache-keyed consistently.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { QuestHistoryResponse, QuestView } from '@scholarxp/api-contracts';
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

type TodayQuestSummary = {
  completed: number;
  total: number;
  max: number;
};

export type TodayQuestList = {
  quests: QuestView[];
  completed: number;
  max: number;
};

const TODAY_QUEST_MAX = 3;

export function useTodayQuestSummaryQuery(enabled: boolean, userId?: number) {
  return useQuery<QuestHistoryResponse, Error, TodayQuestSummary>({
    queryKey: queryKeys.quests.todaySummary(userId ?? null),
    queryFn: () =>
      listQuests({
        dayLimit: 14,
        dayOffset: 0,
      }),
    enabled,
    staleTime: 30_000,
    // Derive today-only progress in one place so global chips and pages stay consistent.
    select: (response) => {
      const todayUtc = new Date().toISOString().slice(0, 10);
      const todayQuests = response.quests.filter((quest) => quest.questDateUtc === todayUtc);
      const completedCount = todayQuests.filter((quest) => quest.isCompleted).length;
      const displayQuestsCount = Math.min(todayQuests.length, TODAY_QUEST_MAX);

      return {
        completed: completedCount,
        total: todayQuests.length,
        max: displayQuestsCount || TODAY_QUEST_MAX,
      };
    },
  });
}

export function useTodayQuestListQuery(enabled: boolean, userId?: number) {
  return useQuery<QuestHistoryResponse, Error, TodayQuestList>({
    queryKey: queryKeys.quests.todayList(userId ?? null),
    queryFn: () =>
      listQuests({
        // A one-day window is enough because this UI only renders the current UTC day.
        dayLimit: 1,
        dayOffset: 0,
      }),
    enabled,
    staleTime: 30_000,
    select: (response) => {
      const todayUtc = new Date().toISOString().slice(0, 10);
      const allToday = response.quests.filter((quest) => quest.questDateUtc === todayUtc);
      const todayQuests = allToday.slice(0, TODAY_QUEST_MAX);

      return {
        quests: todayQuests,
        completed: todayQuests.filter((quest) => quest.isCompleted).length,
        max: todayQuests.length || TODAY_QUEST_MAX,
      };
    },
  });
}
