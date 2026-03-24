// TodayQuestChip owns the student-only quest summary interaction so Header stays focused on layout and auth branches.
import { useEffect, useRef, useState } from 'react';
import { BsTrophyFill } from 'react-icons/bs';
import { useTodayQuestListQuery } from '@/hooks/queries/useQuestsQueries';
import TodayQuestPopover from './TodayQuestPopover';
import MasterQuestStreakChip from './MasterQuestStreakChip';
import styles from './TodayQuestChip.module.css';

type TodayChipAcknowledgement = {
  userId: number;
  dayKey: string;
  completedCount: number;
};

type TodayQuestChipProps = {
  userId: number;
};

const buildTodayChipAcknowledgementStorageKey = (userId: number) =>
  `today-quest-chip-acknowledgement:${userId}`;

const readTodayChipAcknowledgement = (
  userId: number,
): TodayChipAcknowledgement | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = window.sessionStorage.getItem(
    buildTodayChipAcknowledgementStorageKey(userId),
  );

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<TodayChipAcknowledgement>;
    if (
      parsedValue.userId !== userId ||
      typeof parsedValue.dayKey !== 'string' ||
      typeof parsedValue.completedCount !== 'number'
    ) {
      return null;
    }

    return {
      userId: parsedValue.userId,
      dayKey: parsedValue.dayKey,
      completedCount: parsedValue.completedCount,
    };
  } catch {
    return null;
  }
};

export default function TodayQuestChip({ userId }: TodayQuestChipProps) {
  const [isTodayPopoverOpen, setIsTodayPopoverOpen] = useState(false);
  const [todayChipAcknowledgement, setTodayChipAcknowledgement] =
    useState<TodayChipAcknowledgement | null>(() =>
      readTodayChipAcknowledgement(userId),
    );
  const todayChipWrapperRef = useRef<HTMLDivElement | null>(null);
  const todayQuestListQuery = useTodayQuestListQuery(true, userId);
  const todayQuestList = todayQuestListQuery.data;
  const todayQuestLabel = todayQuestList
    ? `${todayQuestList.completed}/${todayQuestList.max}`
    : '--';
  const effectiveTodayChipAcknowledgement =
    todayChipAcknowledgement?.userId === userId
      ? todayChipAcknowledgement
      : readTodayChipAcknowledgement(userId);
  const todayQuestDayKey =
    todayQuestList?.quests[0]?.questDateUtc ??
    todayQuestList?.masterQuest?.questDateUtc ??
    new Date().toISOString().slice(0, 10);
  const completedQuestCount = todayQuestList?.completed ?? 0;
  // The glow only returns when progress changes, so students do not get repeated noise after acknowledging it.
  const shouldGlowTodayChip =
    completedQuestCount > 0 &&
    (effectiveTodayChipAcknowledgement?.dayKey !== todayQuestDayKey ||
      completedQuestCount > effectiveTodayChipAcknowledgement.completedCount);

  useEffect(() => {
    if (!isTodayPopoverOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) {
        return;
      }
      if (todayChipWrapperRef.current?.contains(targetNode)) {
        return;
      }
      setIsTodayPopoverOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTodayPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isTodayPopoverOpen]);

  return (
    <div
      className={`${styles.todayChipWrapper} ${
        shouldGlowTodayChip ? styles.todayChipWrapperGlow : ''
      }`.trim()}
      ref={todayChipWrapperRef}
      data-testid="today-chip-wrapper"
    >
      <button
        type="button"
        className={`${styles.todayChip} ${isTodayPopoverOpen ? styles.todayChipActive : ''}`}
        aria-label={`Today's quests ${todayQuestLabel}`}
        title={`Quests ${todayQuestLabel}`}
        aria-expanded={isTodayPopoverOpen}
        aria-controls="today-quest-popover"
        onClick={() => {
          setIsTodayPopoverOpen((isOpen) => !isOpen);

          const acknowledgement = {
            userId,
            dayKey: todayQuestDayKey,
            completedCount: completedQuestCount,
          };

          // Session storage keeps the dismissal scoped to the current browser session while surviving refreshes.
          window.sessionStorage.setItem(
            buildTodayChipAcknowledgementStorageKey(userId),
            JSON.stringify(acknowledgement),
          );
          setTodayChipAcknowledgement(acknowledgement);
        }}
      >
        <BsTrophyFill className={styles.todayChipIcon} />
        <div className={styles.todayChipContent}>
          <span className={styles.todayChipLabel}>Quests</span>
          <span className={styles.todayChipValue}>{todayQuestLabel}</span>
        </div>
        <MasterQuestStreakChip userId={userId} />
      </button>
      {isTodayPopoverOpen ? (
        <TodayQuestPopover
          id="today-quest-popover"
          quests={todayQuestList?.quests ?? []}
          masterQuest={todayQuestList?.masterQuest ?? null}
          completed={todayQuestList?.completed ?? 0}
          max={todayQuestList?.max ?? 0}
          hasDailyQuests={todayQuestList?.hasDailyQuests ?? false}
          isLoading={todayQuestListQuery.isPending}
          onNavigateToHistory={() => setIsTodayPopoverOpen(false)}
        />
      ) : null}
    </div>
  );
}
