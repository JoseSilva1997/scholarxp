// Orchestrates the Quests page state: authentication-gated history fetching, date grouping, and load-more behavior.
import { useEffect, useMemo, useState } from 'react';
import type { QuestView } from '@scholarxp/api-contracts';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '@/shared/api/get-display-error';
import { useAuth } from '@/context/AuthContext';
import { logError } from '@/utils/logger';
import {
  partitionQuestViewsByTier,
  useQuestHistoryInfiniteQuery,
} from '@/Quests/queries/useQuestsQueries';

// Keep the client page size aligned with the history UI's two-week paging model.
const DAY_PAGE_SIZE = 14;

// Represents a rendered calendar day, including placeholders for missed or ungenerated quest days.
export type QuestDaySection = {
  questDayUtc: string;
  dayLabel: string;
  isToday: boolean;
  isPlaceholder: boolean;
  quests: QuestView[];
  masterQuest: QuestView | null;
};

// Defines the view-model contract returned to the Quests page component.
type UseQuestPageStateResult = {
  daySections: QuestDaySection[];
  isLoading: boolean;
  isLoadingMore: boolean;
  pageError: string | null;
  canLoadMore: boolean;
  loadMore: () => void;
};

// Builds the Quests page view model from auth state, paged server data, and local calendar rules.
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

  // The hook follows a page-state pattern: it hides server-state and projection details from the route component.
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

    // Descending date keys let pagination and timeline rendering share the same newest-first order.
    return Array.from(groupedByDay.entries()).sort(([leftDay], [rightDay]) =>
      leftDay < rightDay ? 1 : -1,
    );
  }, [questHistoryQuery.data?.pages]);

  const timezone = user?.timezone ?? 'UTC';

  const allDaySections = useMemo(() => {
    // en-CA produces YYYY-MM-DD, matching the quest date keys used by the API.
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

  const pageError = questHistoryQuery.error
    ? getDisplayErrorMessage(questHistoryQuery.error, {
        fallbackMessage:
          'We could not load your quest history right now. Please try again.',
      })
    : null;

  // Expands already-fetched days before requesting another server page to avoid unnecessary network calls.
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

// Formats a stored YYYY-MM-DD quest date into the label shown for a history section.
function formatQuestDayLabel(questDayUtc: string, todayLocal: string): string {
  if (questDayUtc === todayLocal) {
    return 'Today';
  }

  // The field stores a local calendar key; UTC formatting preserves the date without timezone rollover.
  const parsedDate = new Date(`${questDayUtc}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsedDate);
}

// Inserts empty day sections between generated quest days so gaps remain visible in the history timeline.
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

// Shifts a YYYY-MM-DD quest key by whole UTC days while preserving API-compatible formatting.
function shiftQuestDay(questDayUtc: string, dayDelta: number): string {
  const parsedDate = new Date(`${questDayUtc}T00:00:00.000Z`);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + dayDelta);
  return parsedDate.toISOString().slice(0, 10);
}
