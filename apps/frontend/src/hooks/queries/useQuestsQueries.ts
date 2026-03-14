// Quests query hooks keep server-state fetch behavior centralized and cache-keyed consistently.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type MasterQuestStreakResponse,
  QuestTypeValues,
  type QuestHistoryResponse,
  type QuestView,
} from '@scholarxp/api-contracts';
import {
  getMasterQuestStreak,
  listQuests,
  recordCompletedUnitReviewQuestProgress,
  recordDailyRevisionQuestProgress,
} from '../../api/quests';
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
  masterQuest: QuestView | null;
  completed: number;
  max: number;
};

const TODAY_QUEST_MAX = 3;

type PartitionedQuestViews = {
  dailyQuests: QuestView[];
  masterQuest: QuestView | null;
};

export function partitionQuestViewsByTier(quests: QuestView[]): PartitionedQuestViews {
  // Keeping tier separation in one helper prevents each screen from re-encoding "master quest is special" rules.
  const dailyQuests: QuestView[] = [];
  let masterQuest: QuestView | null = null;

  for (const quest of quests) {
    if (
      quest.tier === 'master' ||
      quest.type === QuestTypeValues.masterDailyQuests
    ) {
      masterQuest = quest;
      continue;
    }
    dailyQuests.push(quest);
  }

  return {
    dailyQuests,
    masterQuest,
  };
}

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
      const allTodayQuests = response.quests.filter(
        (quest) => quest.questDateUtc === todayUtc,
      );
      const { dailyQuests } = partitionQuestViewsByTier(allTodayQuests);
      const visibleDailyQuests = dailyQuests.slice(0, TODAY_QUEST_MAX);
      const completedCount = visibleDailyQuests.filter((quest) => quest.isCompleted).length;
      const displayQuestsCount = visibleDailyQuests.length;

      return {
        completed: completedCount,
        total: visibleDailyQuests.length,
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
      const { dailyQuests, masterQuest } = partitionQuestViewsByTier(allToday);
      const todayQuests = dailyQuests.slice(0, TODAY_QUEST_MAX);

      return {
        quests: todayQuests,
        masterQuest,
        completed: todayQuests.filter((quest) => quest.isCompleted).length,
        max: todayQuests.length || TODAY_QUEST_MAX,
      };
    },
  });
}

export function useMasterQuestStreakQuery(enabled: boolean, userId?: number) {
  return useQuery<MasterQuestStreakResponse>({
    queryKey: queryKeys.quests.masterStreak(userId ?? null),
    queryFn: getMasterQuestStreak,
    // Header reads should wait for auth bootstrap so anonymous shells do not fire quest requests.
    enabled,
    staleTime: 30_000,
  });
}

export function useRecordDailyRevisionQuestProgressMutation(moduleId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (moduleId === null) {
        throw new Error('Cannot record daily revision quest progress without a valid module id.');
      }
      return recordDailyRevisionQuestProgress(moduleId);
    },
    onSuccess: async () => {
      // Quest triggers can award both a daily quest and the master quest, so refresh quest reads and avatar XP together.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.quests.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.quests.masterStreakAll,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
      ]);
    },
  });
}

export function useRecordCompletedUnitReviewQuestProgressMutation(
  moduleId: number | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moduleUnitId: number) => {
      if (moduleId === null) {
        throw new Error(
          'Cannot record completed-unit review quest progress without a valid module id.',
        );
      }
      return recordCompletedUnitReviewQuestProgress(moduleId, moduleUnitId);
    },
    onSuccess: async () => {
      // Review triggers can complete both the retry quest and the master quest, so stale quest and avatar data must be refreshed.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.quests.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.quests.masterStreakAll,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
      ]);
    },
  });
}
