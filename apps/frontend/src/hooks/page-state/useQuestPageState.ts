// Quests page-state orchestrates quest history fetching, UTC day grouping, and incremental day pagination.
import { useEffect, useMemo, useState } from 'react';
import type { Quest } from '@scholarxp/api-contracts';
import { getDisplayErrorMessage, shouldLogApiError } from '../../api/get-display-error';
import { useAuth } from '../../context/AuthContext';
import { logError } from '../../utils/logger';
import { useQuestHistoryQuery } from '../queries/useQuestsQueries';

const QUESTS_PER_DAY = 3;
const DAY_PAGE_SIZE = 14;

export type QuestDaySection = {
  questDayUtc: string;
  dayLabel: string;
  quests: Array<Quest | null>;
};

type UseQuestPageStateResult = {
  daySections: QuestDaySection[];
  isLoading: boolean;
  pageError: string | null;
  canLoadMore: boolean;
  loadMore: () => void;
};

export function useQuestPageState(): UseQuestPageStateResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [visibleDayCount, setVisibleDayCount] = useState(DAY_PAGE_SIZE);
  const isHistoryQueryEnabled = !isAuthLoading && Boolean(user);
  const questHistoryQuery = useQuestHistoryQuery(isHistoryQueryEnabled);

  useEffect(() => {
    if (!questHistoryQuery.error) return;
    if (shouldLogApiError(questHistoryQuery.error)) {
      logError(questHistoryQuery.error, { feature: 'quests', action: 'history' });
    }
  }, [questHistoryQuery.error]);

  const groupedQuestDays = useMemo(() => {
    const quests = questHistoryQuery.data?.quests ?? [];
    const groupedByDay = new Map<string, Quest[]>();

    for (const quest of quests) {
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
  }, [questHistoryQuery.data?.quests]);

  const daySections = useMemo(() => {
    return groupedQuestDays.slice(0, visibleDayCount).map(([questDayUtc, dayQuests]) => ({
      questDayUtc,
      dayLabel: formatQuestDayLabel(questDayUtc),
      // Fixed 3-slot shape keeps cards consistent even if historical data is incomplete.
      quests: Array.from({ length: QUESTS_PER_DAY }, (_, index) => dayQuests[index] ?? null),
    }));
  }, [groupedQuestDays, visibleDayCount]);

  const canLoadMore = groupedQuestDays.length > visibleDayCount;
  const isLoading = isHistoryQueryEnabled && questHistoryQuery.isPending;
  const pageError = questHistoryQuery.error
    ? getDisplayErrorMessage(questHistoryQuery.error, {
        fallbackMessage: 'We could not load your quest history right now. Please try again.',
      })
    : null;

  const loadMore = () => {
    setVisibleDayCount((currentValue) => currentValue + DAY_PAGE_SIZE);
  };

  return {
    daySections,
    isLoading,
    pageError,
    canLoadMore,
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
