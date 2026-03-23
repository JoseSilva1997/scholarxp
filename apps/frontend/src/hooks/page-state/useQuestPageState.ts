// Quests page-state orchestrates paged quest-history fetching, UTC day grouping, and load-more actions.
import { useEffect, useMemo } from 'react';
import type { QuestView } from '@scholarxp/api-contracts';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import { useAuth } from '../../context/AuthContext';
import { logError } from '../../utils/logger';
import {
  partitionQuestViewsByTier,
  useQuestHistoryInfiniteQuery,
} from '../queries/useQuestsQueries';

// Define the number of days to fetch per page for quest history
const DAY_PAGE_SIZE = 14;

// Type definition for a single day's quest section
export type QuestDaySection = {
  questDayUtc: string;
  dayLabel: string;
  isToday: boolean;
  quests: QuestView[];
  masterQuest: QuestView | null;
};

// The result type returned by the useQuestPageState hook
// This ensures the hook's return structure is clear and consistent
// for consumers of this hook.
type UseQuestPageStateResult = {
  daySections: QuestDaySection[];
  isLoading: boolean;
  isLoadingMore: boolean;
  pageError: string | null;
  canLoadMore: boolean;
  loadMore: () => void;
};

// Main hook to manage the state of the quest page
export function useQuestPageState(): UseQuestPageStateResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const isHistoryQueryEnabled = !isAuthLoading && Boolean(user);

  // Fetch quest history data using an infinite query pattern
  const questHistoryQuery = useQuestHistoryInfiniteQuery(
    isHistoryQueryEnabled,
    DAY_PAGE_SIZE,
  );

  // Log errors if the quest history query fails
  useEffect(() => {
    if (!questHistoryQuery.error) return;
    if (shouldLogApiError(questHistoryQuery.error)) {
      logError(questHistoryQuery.error, { feature: 'quests', action: 'history' });
    }
  }, [questHistoryQuery.error]);

  // Group quests by their UTC day for easier display and organization
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

    // Sort days in descending order (most recent first)
    return Array.from(groupedByDay.entries()).sort(([leftDay], [rightDay]) =>
      leftDay < rightDay ? 1 : -1,
    );
  }, [questHistoryQuery.data?.pages]);

  // Transform grouped quest days into a format suitable for the UI
  const daySections = useMemo(() => {
    const todayUtc = formatDateToUtcDay(new Date());
    return groupedQuestDays.map(([questDayUtc, dayQuests]) => {
      const { dailyQuests, masterQuest } = partitionQuestViewsByTier(dayQuests);

      return {
        questDayUtc,
        dayLabel: formatQuestDayLabel(questDayUtc),
        isToday: questDayUtc === todayUtc,
        // The page renders only the generated daily quests while the master quest gets its own chest treatment.
        quests: dailyQuests,
        masterQuest,
      };
    });
  }, [groupedQuestDays]);

  // Generate a user-friendly error message if the query fails
  const pageError = questHistoryQuery.error
    ? getDisplayErrorMessage(questHistoryQuery.error, {
        fallbackMessage:
          'We could not load your quest history right now. Please try again.',
      })
    : null;

  // Function to load more quest history pages
  const loadMore = () => {
    // Query metadata controls continuation so UI only requests valid next-day windows.
    if (questHistoryQuery.hasNextPage && !questHistoryQuery.isFetchingNextPage) {
      void questHistoryQuery.fetchNextPage();
    }
  };

  // Return the structured state for the quest page
  return {
    daySections,
    isLoading: isHistoryQueryEnabled && questHistoryQuery.isPending,
    isLoadingMore: questHistoryQuery.isFetchingNextPage,
    pageError,
    canLoadMore: Boolean(questHistoryQuery.hasNextPage),
    loadMore,
  };
}

// Helper function to format a UTC day into a user-friendly label
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

// Helper function to convert a Date object to a UTC day string
function formatDateToUtcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}
