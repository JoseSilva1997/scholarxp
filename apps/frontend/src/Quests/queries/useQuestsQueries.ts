// Centralizes Quests server-state access, cache keys, and mutation invalidation for React Query consumers.
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
} from '@/Quests/api/quests';
import { queryKeys } from '@/shared/hooks/query-keys';

// Implements the React Query infinite-query pattern for day-window pagination of quest history.
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

// Splits regular daily quests from the master quest so callers can render each tier differently.
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

// Selects the current local day's daily-quest progress from a broader history response.
function selectTodayDailyQuestState(quests: QuestView[], userTimezone: string): TodayDailyQuestState {
  // en-CA produces a stable YYYY-MM-DD key matching the backend quest-date contract.
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(new Date());
  const allTodayQuests = quests.filter((quest) => quest.questDateUtc === todayLocal);
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

// Provides compact current-day progress for header chips and other summary-only UI surfaces.
export function useTodayQuestSummaryQuery(enabled: boolean, userId?: number, userTimezone = 'UTC') {
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
      const todayDailyQuestState = selectTodayDailyQuestState(response.quests, userTimezone);

      return {
        completed: todayDailyQuestState.completed,
        total: todayDailyQuestState.quests.length,
        max: todayDailyQuestState.max,
        hasDailyQuests: todayDailyQuestState.hasDailyQuests,
      };
    },
  });
}

// Provides the current day's renderable quest list plus the separate master quest indicator.
export function useTodayQuestListQuery(enabled: boolean, userId?: number, userTimezone = 'UTC') {
  return useQuery<QuestHistoryResponse, Error, TodayQuestList>({
    queryKey: queryKeys.quests.todayList(userId ?? null),
    queryFn: () =>
      listQuests({
        // A one-day window is enough because this UI only renders the current local day.
        dayLimit: 1,
        dayOffset: 0,
      }),
    enabled,
    staleTime: 30_000,
    select: (response) => {
      // Filtering by the user's local day prevents late-night UTC boundaries from showing the wrong quest set.
      const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(new Date());
      const allToday = response.quests.filter((quest) => quest.questDateUtc === todayLocal);
      const { masterQuest } = partitionQuestViewsByTier(allToday);
      const todayDailyQuestState = selectTodayDailyQuestState(response.quests, userTimezone);

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

// Reads master-quest streak state for header status and related reward affordances.
export function useMasterQuestStreakQuery(enabled: boolean, userId?: number) {
  return useQuery<MasterQuestStreakResponse>({
    queryKey: queryKeys.quests.masterStreak(userId ?? null),
    queryFn: getMasterQuestStreak,
    // Header reads should wait for auth bootstrap so anonymous shells do not fire quest requests.
    enabled,
    staleTime: 30_000,
  });
}

// Creates the mutation used by practice entry points to credit daily revision quest progress.
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

// Creates the mutation used after a completed unit review to credit the relevant quest.
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
