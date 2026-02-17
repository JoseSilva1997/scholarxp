// Quests page-state hook owns day-label derivation so the route stays focused on rendering.
import { useMemo } from 'react';

export type QuestDaySection = {
  questDayUtc: string;
  dayLabel: string;
};

type UseQuestPageStateResult = {
  daySections: QuestDaySection[];
};

export function useQuestPageState(): UseQuestPageStateResult {
  const daySections = useMemo(() => {
    // Static UTC day list keeps UI iteration deterministic until quests are fetched from backend.
    const questDays = buildQuestDayList();
    return questDays.map((questDayUtc) => ({
      questDayUtc,
      dayLabel: formatQuestDayLabel(questDayUtc),
    }));
  }, []);

  return { daySections };
}

function buildQuestDayList(): string[] {
  const today = new Date();
  const yesterday = new Date(today);
  const twoDaysAgo = new Date(today);

  yesterday.setUTCDate(today.getUTCDate() - 1);
  twoDaysAgo.setUTCDate(today.getUTCDate() - 2);

  return [today, yesterday, twoDaysAgo].map(formatDateToUtcDay);
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
