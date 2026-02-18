// Reusable quest history day card that keeps a fixed 3-slot hex layout and only renders quest badges.
import type { Quest } from '@scholarxp/api-contracts';
import { BsHexagon } from 'react-icons/bs';
import { getQuestBadge } from '../constants/quest-constants';
import styles from './QuestHistoryCard.module.css';

type QuestHistoryCardProps = {
  quests: Array<Quest | null>;
  className?: string;
};

const QUEST_SLOT_COUNT = 3;

export default function QuestHistoryCard({
  quests,
  className,
}: QuestHistoryCardProps) {
  // Fixed slot count keeps day cards visually consistent during early UI iteration.
  const slots = Array.from({ length: QUEST_SLOT_COUNT }, (_, index) => quests[index] ?? null);

  return (
    <div className={`${styles.card} ${className ?? ''}`.trim()}>
      <div className={styles.slotRow}>
        {slots.map((slotQuest, slotIndex) => {
          // Determine if slot is incomplete (empty or quest not finished).
          const isIncomplete = !slotQuest || !slotQuest.isCompleted;
          
          return (
            <div
              key={slotIndex}
              className={`${styles.slot} ${isIncomplete ? styles.incompleteSlot : ''}`.trim()}
              data-testid="quest-slot"
            >
              {slotQuest ? (
                <img
                  src={getQuestBadge(slotQuest)}
                  alt={`${slotQuest.moduleTitle} quest badge`}
                  className={styles.badge}
                />
              ) : (
                // Icon placeholder makes empty quest slots visually obvious when less than three quests exist for a day.
                <BsHexagon className={styles.emptyIcon} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
