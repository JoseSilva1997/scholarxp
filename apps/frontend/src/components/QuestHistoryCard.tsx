// Reusable quest history day card that keeps a fixed 3-slot hex layout and only renders quest badges.
import { BsHexagon } from 'react-icons/bs';
import styles from './QuestHistoryCard.module.css';

type QuestHistoryCardProps = {
  className?: string;
};

const QUEST_SLOT_COUNT = 3;

export default function QuestHistoryCard({
  className,
}: QuestHistoryCardProps) {
  // Fixed slot count keeps day cards visually consistent during early UI iteration.
  const slots = Array.from({ length: QUEST_SLOT_COUNT }, (_, index) => index);

  return (
    <div className={`${styles.card} ${className ?? ''}`.trim()}>
      <div className={styles.slotRow}>
        {slots.map((slotIndex) => (
          <div
            key={slotIndex}
            className={styles.slot}
            data-testid="quest-slot"
          >
              {/* Icon placeholder makes empty quest slots visually obvious before badge assets are wired. */}
              <BsHexagon className={styles.emptyIcon} aria-hidden="true" />
            </div>
        ))}
      </div>
    </div>
  );
}
