// Quests page-state orchestrates paged quest-history fetching, local-day grouping, and load-more actions.
import { useEffect, useMemo, useState } from 'react';
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
  isPlaceholder: boolean;
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
  const activeUserId = user?.id ?? null;
  const [visibleDayState, setVisibleDayState] = useState<{
    userId: number | null;
    count: number;
  }>({
    userId: activeUserId,
    count: DAY_PAGE_SIZE,
  });

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

  const timezone = user?.timezone ?? 'UTC';

  // Transform grouped quest days into a format suitable for the UI
  const allDaySections = useMemo(() => {
    const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    const groupedQuestDaysWithPlaceholders = fillMissingQuestDays(groupedQuestDays, todayLocal);

    return groupedQuestDaysWithPlaceholders.map(([questDayUtc, dayQuests]) => {
      const { dailyQuests, masterQuest } = partitionQuestViewsByTier(dayQuests);

      return {
        questDayUtc,
        dayLabel: formatQuestDayLabel(questDayUtc, todayLocal),
        isToday: questDayUtc === todayLocal,
        isPlaceholder: dayQuests.length === 0,
        // The page renders only the generated daily quests while the master quest gets its own chest treatment.
        quests: dailyQuests,
        masterQuest,
      };
    });
  }, [groupedQuestDays, timezone]);

  const visibleDayCount =
    visibleDayState.userId === activeUserId ? visibleDayState.count : DAY_PAGE_SIZE;

  const daySections = useMemo(
    () => allDaySections.slice(0, visibleDayCount),
    [allDaySections, visibleDayCount],
  );

  // Generate a user-friendly error message if the query fails
  const pageError = questHistoryQuery.error
    ? getDisplayErrorMessage(questHistoryQuery.error, {
        fallbackMessage:
          'We could not load your quest history right now. Please try again.',
      })
    : null;

  // Function to load more quest history pages
  const loadMore = () => {
    if (visibleDayCount < allDaySections.length) {
      setVisibleDayState((currentState) => ({
        userId: activeUserId,
        count:
          (currentState.userId === activeUserId
            ? currentState.count
            : DAY_PAGE_SIZE) + DAY_PAGE_SIZE,
      }));
      return;
    }

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
    canLoadMore:
      visibleDayCount < allDaySections.length || Boolean(questHistoryQuery.hasNextPage),
    loadMore,
  };
}

// Formats a stored YYYY-MM-DD date key into a display label.
// questDayUtc represents the user's local calendar date (despite the field name),
// so parsing it as UTC midnight and formatting in UTC preserves the stored date components.
function formatQuestDayLabel(questDayUtc: string, todayLocal: string): string {
  if (questDayUtc === todayLocal) {
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

function fillMissingQuestDays(
  groupedQuestDays: Array<[string, QuestView[]]>,
  todayLocal: string,
): Array<[string, QuestView[]]> {
  if (groupedQuestDays.length === 0) {
    return [];
  }

  // Keep calendar gaps visible so missed days do not collapse into one continuous streak.
  const filledQuestDays: Array<[string, QuestView[]]> = [];
  let expectedQuestDayUtc =
    groupedQuestDays[0][0] < todayLocal ? todayLocal : groupedQuestDays[0][0];

  for (const [questDayUtc, dayQuests] of groupedQuestDays) {
    while (expectedQuestDayUtc > questDayUtc) {
      filledQuestDays.push([expectedQuestDayUtc, []]);
      expectedQuestDayUtc = shiftQuestDay(expectedQuestDayUtc, -1);
    }

    filledQuestDays.push([questDayUtc, dayQuests]);
    expectedQuestDayUtc = shiftQuestDay(questDayUtc, -1);
  }

  return filledQuestDays;
}

function shiftQuestDay(questDayUtc: string, dayDelta: number): string {
  const parsedDate = new Date(`${questDayUtc}T00:00:00.000Z`);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + dayDelta);
  return parsedDate.toISOString().slice(0, 10);
}
