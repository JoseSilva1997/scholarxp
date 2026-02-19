// Reusable quest history day card that keeps a fixed 3-slot hex layout and only renders quest badges.
import type { QuestView } from '@scholarxp/api-contracts';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { BsHexagon } from 'react-icons/bs';
import { getQuestBadge } from '../constants/quest-constants';
import QuestBadgeTooltip from './QuestBadgeTooltip';
import styles from './QuestHistoryCard.module.css';

type QuestHistoryCardProps = {
  quests: Array<QuestView | null>;
  className?: string;
  activeTooltipId?: string | null;
  onTooltipToggle?: (nextTooltipId: string | null) => void;
  tooltipIdPrefix?: string;
};

const QUEST_SLOT_COUNT = 3;

export default function QuestHistoryCard({
  quests,
  className,
  activeTooltipId,
  onTooltipToggle,
  tooltipIdPrefix = 'quest-slot',
}: QuestHistoryCardProps) {
  const [openTooltipSlotIndex, setOpenTooltipSlotIndex] = useState<number | null>(null);
  const isControlledTooltip = typeof onTooltipToggle === 'function';
  const hasOpenTooltip = isControlledTooltip
    ? activeTooltipId !== null
    : openTooltipSlotIndex !== null;
  // Fixed slot count keeps day cards visually consistent during early UI iteration.
  const slots = Array.from({ length: QUEST_SLOT_COUNT }, (_, index) => quests[index] ?? null);

  useEffect(() => {
    if (!hasOpenTooltip) return;

    const handleDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Keep tooltip open while interacting with the badge trigger or tooltip itself.
      const clickedTooltip = target.closest('[data-quest-tooltip="true"]');
      const clickedBadgeButton = target.closest(`.${styles.badgeButton}`);
      if (clickedTooltip || clickedBadgeButton) {
        return;
      }

      if (isControlledTooltip) {
        onTooltipToggle(null);
      } else {
        setOpenTooltipSlotIndex(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentPointerDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
    };
  }, [hasOpenTooltip, isControlledTooltip, onTooltipToggle]);

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
              className={`${styles.slot} ${isIncomplete ? styles.incompleteSlot : ''} ${
                isTooltipOpen ? styles.openSlot : ''
              }`.trim()}
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
