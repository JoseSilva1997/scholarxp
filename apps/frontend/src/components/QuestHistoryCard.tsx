// Reusable quest history day card that keeps a fixed 3-slot hex layout and only renders quest badges.
import { QuestTypeValues, type QuestView } from '@scholarxp/api-contracts';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import {
  BsBoxSeam,
  BsHexagon,
  BsInfoCircle,
  BsJournalText,
  BsLightningChargeFill,
  BsStars,
  BsTrophy,
} from 'react-icons/bs';
import { getQuestBadge } from '../constants/quest-constants';
import styles from './QuestHistoryCard.module.css';

type QuestHistoryCardProps = {
  quests: Array<QuestView | null>;
  className?: string;
  activeTooltipId?: string | null;
  onTooltipToggle?: (nextTooltipId: string | null) => void;
  tooltipIdPrefix?: string;
};

const QUEST_SLOT_COUNT = 3;

type QuestBadgeTooltipProps = {
  quest: QuestView;
};

function QuestBadgeTooltip({ quest }: QuestBadgeTooltipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95, translateX: '-50%' }}
      animate={{ opacity: 1, y: 0, scale: 1, translateX: '-50%' }}
      exit={{ opacity: 0, scale: 0.95, translateX: '-50%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={styles.tooltip}
      role="tooltip"
    >
      <div className={styles.tooltipHeader}>
        <BsStars className={styles.tooltipIcon} />
        <span className={styles.tooltipTitle}>Quest Reward</span>
      </div>

      <div className={styles.tooltipBody}>
        {/* Keep tooltip fields explicit so quest metadata is quickly scannable. */}
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>
            <BsBoxSeam /> Module:
          </span>{' '}
          <span className={styles.tooltipValue}>{quest.moduleTitle}</span>
        </div>

        {quest.type === QuestTypeValues.completeNewUnit && quest.moduleUnitTitle ? (
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>
              <BsJournalText /> Lesson:
            </span>{' '}
            <span className={styles.tooltipValue}>{quest.moduleUnitTitle}</span>
          </div>
        ) : null}

        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>
            <BsInfoCircle aria-hidden="true" /> Info:
          </span>{' '}
          <span className={styles.tooltipValue}>{quest.description}</span>
        </div>

        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>
            <BsTrophy /> Reward:
          </span>{' '}
          <span className={styles.expValue}>
            <BsLightningChargeFill aria-hidden="true" /> +{quest.expGranted} XP
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function QuestHistoryCard({
  quests,
  className,
  activeTooltipId,
  onTooltipToggle,
  tooltipIdPrefix = 'quest-slot',
}: QuestHistoryCardProps) {
  const [openTooltipSlotIndex, setOpenTooltipSlotIndex] = useState<number | null>(null);
  const isControlledTooltip = typeof onTooltipToggle === 'function';
  // Fixed slot count keeps day cards visually consistent during early UI iteration.
  const slots = Array.from({ length: QUEST_SLOT_COUNT }, (_, index) => quests[index] ?? null);

  return (
    <div className={`${styles.card} ${className ?? ''}`.trim()}>
      <div className={styles.slotRow}>
        {slots.map((slotQuest, slotIndex) => {
          // Determine if slot is incomplete (empty or quest not finished).
          const isIncomplete = !slotQuest || !slotQuest.isCompleted;
          const tooltipId = `${tooltipIdPrefix}-${slotIndex}`;
          const isTooltipOpen = isControlledTooltip
            ? activeTooltipId === tooltipId
            : openTooltipSlotIndex === slotIndex;
          
          return (
            <div
              key={slotIndex}
              className={`${styles.slot} ${isIncomplete ? styles.incompleteSlot : ''}`.trim()}
              data-testid="quest-slot"
            >
              {slotQuest ? (
                <>
                  <button
                    type="button"
                    className={styles.badgeButton}
                    aria-label={`${slotQuest.moduleTitle} quest details`}
                    onClick={() => {
                      if (isControlledTooltip) {
                        onTooltipToggle(isTooltipOpen ? null : tooltipId);
                        return;
                      }
                      setOpenTooltipSlotIndex((currentIndex) =>
                        currentIndex === slotIndex ? null : slotIndex,
                      );
                    }}
                  >
                    <img
                      src={getQuestBadge(slotQuest)}
                      alt={`${slotQuest.moduleTitle} quest badge`}
                      className={styles.badge}
                    />
                  </button>
                  <AnimatePresence>
                    {isTooltipOpen ? <QuestBadgeTooltip quest={slotQuest} /> : null}
                  </AnimatePresence>
                </>
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
