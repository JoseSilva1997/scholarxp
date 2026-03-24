// MasterQuestStreakChip renders the student's global master-quest streak.
import { FaCircleInfo, FaFire } from 'react-icons/fa6';
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

export default function MasterQuestStreakChip({
  userId,
}: MasterQuestStreakChipProps) {
  const masterQuestStreakQuery = useMasterQuestStreakQuery(true, userId);
  const streakStatus = masterQuestStreakQuery.data ?? DEFAULT_STREAK_STATUS;
  const beadCount = Math.max(0, Math.min(streakStatus.currentStreak, streakStatus.maxStreak));
  const beadSlots = Array.from({ length: streakStatus.maxStreak }, (_, index) => index);

  return (
    <div className={styles.chipGroup} data-testid="master-quest-streak-group">
      <div
        className={styles.chip}
        aria-label={`Master quest streak ${streakStatus.currentStreak} out of ${streakStatus.maxStreak}.`}
        data-testid="master-quest-streak-chip"
      >
        <div className={styles.topRow}>
          <span
            className={styles.infoWrapper}
            role="note"
            aria-label="Master quest streak help"
            data-testid="master-quest-streak-help"
            onClick={(e) => e.stopPropagation()}
          >
            <FaCircleInfo className={styles.infoIcon} aria-hidden="true" />
            {/* CSS-only tooltip keeps the help affordance lightweight and avoids mixing tooltip state with chip collapse state. */}
            <div className={styles.infoBubble} role="tooltip">
              <p className={styles.infoHeading}>Master Quest Streak</p>
              <p className={styles.infoText}>
                Complete the master quest on consecutive days to build your
                streak.
              </p>
              <p className={styles.infoText}>
                Each increment adds 10% to the next master quest reward, up to 50%.
              </p>
              <p className={styles.infoText}>
                Missing a day resets the streak.
              </p>
            </div>
          </span>
          <span className={styles.screenReaderLabel}>
            Master quest streak bonus {streakStatus.bonusPercent} percent
          </span>
          <div className={styles.flameContainer}>
            <FaFire className={styles.flame} aria-hidden="true" />
          </div>
          <span className={styles.count}>{streakStatus.currentStreak}</span>
        </div>
        <div className={styles.beadsContainer} aria-hidden="true">
          <div className={styles.beadRow}>
            {beadSlots.map((slot) => (
              <span
                key={slot}
                className={`${styles.bead} ${slot < beadCount ? styles.beadActive : ''}`.trim()}
                data-testid={`master-streak-bead-${slot + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
