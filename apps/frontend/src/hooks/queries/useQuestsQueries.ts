// Quests query hooks keep server-state fetch behavior centralized and cache-keyed consistently.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type MasterQuestStreakResponse,
  QuestTypeValues,
  type QuestHistoryResponse,
  type QuestView,
} from '@scholarxp/api-contracts';
import { MAX_DAILY_QUEST_COUNT } from '@scholarxp/constants';
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
  hasDailyQuests: boolean;
};

export type TodayQuestList = {
  quests: QuestView[];
  masterQuest: QuestView | null;
  completed: number;
  max: number;
  hasDailyQuests: boolean;
};

const TODAY_QUEST_MAX = MAX_DAILY_QUEST_COUNT;

type PartitionedQuestViews = {
  dailyQuests: QuestView[];
  masterQuest: QuestView | null;
};

type TodayDailyQuestState = {
  quests: QuestView[];
  completed: number;
  max: number;
  hasDailyQuests: boolean;
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

function selectTodayDailyQuestState(quests: QuestView[]): TodayDailyQuestState {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const allTodayQuests = quests.filter((quest) => quest.questDateUtc === todayUtc);
  const { dailyQuests } = partitionQuestViewsByTier(allTodayQuests);
  const todayDailyQuests = dailyQuests.slice(0, TODAY_QUEST_MAX);
  const completedCount = todayDailyQuests.filter((quest) => quest.isCompleted).length;

  // An empty quest list is a real "no quests available" state, not zero progress toward a 3-quest target.
  const hasDailyQuests = todayDailyQuests.length > 0;

  return {
    quests: todayDailyQuests,
    completed: completedCount,
    max: hasDailyQuests ? todayDailyQuests.length : 0,
    hasDailyQuests,
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
      const todayDailyQuestState = selectTodayDailyQuestState(response.quests);

      return {
        completed: todayDailyQuestState.completed,
        total: todayDailyQuestState.quests.length,
        max: todayDailyQuestState.max,
        hasDailyQuests: todayDailyQuestState.hasDailyQuests,
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
      const { masterQuest } = partitionQuestViewsByTier(allToday);
      const todayDailyQuestState = selectTodayDailyQuestState(response.quests);

      return {
        quests: todayDailyQuestState.quests,
        masterQuest,
        completed: todayDailyQuestState.completed,
        max: todayDailyQuestState.max,
        hasDailyQuests: todayDailyQuestState.hasDailyQuests,
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
      // The broad quests key already covers master-streak and today-list subscribers,
      // so one quest invalidation is enough to avoid duplicate refetches.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.quests.all }),
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
      // The broad quests key already covers master-streak and today-list subscribers,
      // so one quest invalidation is enough to avoid duplicate refetches.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.quests.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
      ]);
    },
  });
}
