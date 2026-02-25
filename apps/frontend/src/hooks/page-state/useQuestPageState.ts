// Quests page-state orchestrates paged quest-history fetching, UTC day grouping, and load-more actions.
import { useEffect, useMemo } from 'react';
import type { QuestView } from '@scholarxp/api-contracts';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { useAuth } from '../../context/AuthContext';
import { logError } from '../../utils/logger';
import { useQuestHistoryInfiniteQuery } from '../queries/useQuestsQueries';

const DAY_PAGE_SIZE = 14;

export type QuestDaySection = {
  questDayUtc: string;
  dayLabel: string;
  quests: Array<QuestView | null>;
};

type UseQuestPageStateResult = {
  daySections: QuestDaySection[];
  isLoading: boolean;
  isLoadingMore: boolean;
  pageError: string | null;
  canLoadMore: boolean;
  loadMore: () => void;
};

export function useQuestPageState(): UseQuestPageStateResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const isHistoryQueryEnabled = !isAuthLoading && Boolean(user);
  const questHistoryQuery = useQuestHistoryInfiniteQuery(
    isHistoryQueryEnabled,
    DAY_PAGE_SIZE,
  );

  useEffect(() => {
    if (!questHistoryQuery.error) return;
    if (shouldLogApiError(questHistoryQuery.error)) {
      logError(questHistoryQuery.error, { feature: 'quests', action: 'history' });
    }
  }, [questHistoryQuery.error]);

  const groupedQuestDays = useMemo(() => {
    const groupedByDay = new Map<string, QuestView[]>();
    const pages = questHistoryQuery.data?.pages ?? [];
    const flatQuests = pages.flatMap((page) => page.quests);

    for (const quest of flatQuests) {
      const dayQuests = groupedByDay.get(quest.questDateUtc);
      if (dayQuests) {
        dayQuests.push(quest);
      } else {
        groupedByDay.set(quest.questDateUtc, [quest]);
      }
    }

    return Array.from(groupedByDay.entries()).sort(([leftDay], [rightDay]) =>
      leftDay < rightDay ? 1 : -1,
    );
  }, [questHistoryQuery.data?.pages]);

  const daySections = useMemo(() => {
    return groupedQuestDays.map(([questDayUtc, dayQuests]) => ({
      questDayUtc,
      dayLabel: formatQuestDayLabel(questDayUtc),
      // Use only available quests for the day; no fixed slot count padding.
      quests: dayQuests,
    }));
  }, [groupedQuestDays]);

  const pageError = questHistoryQuery.error
    ? getDisplayErrorMessage(questHistoryQuery.error, {
        fallbackMessage:
          'We could not load your quest history right now. Please try again.',
      })
    : null;

  const loadMore = () => {
    // Query metadata controls continuation so UI only requests valid next-day windows.
    if (questHistoryQuery.hasNextPage && !questHistoryQuery.isFetchingNextPage) {
      void questHistoryQuery.fetchNextPage();
    }
  };

  return {
    daySections,
    isLoading: isHistoryQueryEnabled && questHistoryQuery.isPending,
    isLoadingMore: questHistoryQuery.isFetchingNextPage,
    pageError,
    canLoadMore: Boolean(questHistoryQuery.hasNextPage),
    loadMore,
  };
}

function formatQuestDayLabel(questDayUtc: string): string {
  const todayUtc = formatDateToUtcDay(new Date());
  if (questDayUtc === todayUtc) {
    return 'Today';
  }

  const parsedDate = new Date(`${questDayUtc}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsedDate);
}

function formatDateToUtcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}
