// MasterQuestStreakChip renders the student's global master-quest streak in the header and keeps the collapse preference local to the browser.
import { useEffect, useState } from 'react';
import { FaFire } from 'react-icons/fa6';
import {
  MASTER_QUEST_STREAK_MAX,
  MASTER_QUEST_STREAK_PERCENT_PER_STEP,
} from '@scholarxp/constants';
import { useMasterQuestStreakQuery } from '@/hooks/queries/useQuestsQueries';
import styles from './MasterQuestStreakChip.module.css';

type MasterQuestStreakChipProps = {
  userId: number;
};

const DEFAULT_STREAK_STATUS = {
  currentStreak: 0,
  maxStreak: MASTER_QUEST_STREAK_MAX,
  bonusPercent: 0,
  bonusPercentPerStep: MASTER_QUEST_STREAK_PERCENT_PER_STEP,
  lastCompletedQuestDateUtc: null,
};

const buildCollapseStorageKey = (userId: number) =>
  `master-quest-streak-chip-collapsed:${userId}`;

function readCollapsePreference(userId: number): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const storedValue = window.localStorage.getItem(buildCollapseStorageKey(userId));
  if (storedValue === 'true') {
    return true;
  }
  if (storedValue === 'false') {
    return false;
  }

  // Mobile defaults to collapsed so the header keeps enough room for the quest chip and user badge.
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 768px)').matches
    : false;
}

export default function MasterQuestStreakChip({
  userId,
}: MasterQuestStreakChipProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() =>
    readCollapsePreference(userId),
  );
  const masterQuestStreakQuery = useMasterQuestStreakQuery(true, userId);
  const streakStatus = masterQuestStreakQuery.data ?? DEFAULT_STREAK_STATUS;
  const beadCount = Math.max(0, Math.min(streakStatus.currentStreak, streakStatus.maxStreak));
  const beadSlots = Array.from({ length: streakStatus.maxStreak }, (_, index) => index);

  useEffect(() => {
    setIsCollapsed(readCollapsePreference(userId));
  }, [userId]);

  return (
    <button
      type="button"
      className={`${styles.chip} ${isCollapsed ? styles.chipCollapsed : ''}`.trim()}
      aria-expanded={!isCollapsed}
      aria-label={`Master quest streak ${streakStatus.currentStreak} out of ${streakStatus.maxStreak}. ${
        isCollapsed ? 'Expand streak details.' : 'Collapse streak details.'
      }`}
      data-testid="master-quest-streak-chip"
      onClick={() => {
        setIsCollapsed((previousValue) => {
          const nextValue = !previousValue;

          // Persist only the collapse preference because the streak count itself is backend-owned state.
          window.localStorage.setItem(
            buildCollapseStorageKey(userId),
            String(nextValue),
          );

          return nextValue;
        });
      }}
    >
      <span className={styles.screenReaderLabel}>
        Master quest streak bonus {streakStatus.bonusPercent} percent
      </span>
      <div className={styles.visualGroup}>
        <FaFire className={styles.flame} aria-hidden="true" />
        {!isCollapsed ? (
          <div className={styles.beadRow} aria-hidden="true">
            {beadSlots.map((slot) => (
              <span
                key={slot}
                className={`${styles.bead} ${slot < beadCount ? styles.beadActive : ''}`.trim()}
                data-testid={`master-streak-bead-${slot + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <span className={styles.count}>{streakStatus.currentStreak}</span>
    </button>
  );
}
