// Renders one day's daily quest badges and coordinates tooltip interactions for the quest history timeline.
import { QuestTypeValues, type QuestView } from '@scholarxp/api-contracts';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { getQuestBadge } from '@/shared/constants/quest-constants';
import QuestBadgeTooltip from '@/Quests/components/quest-history/QuestBadgeTooltip';
import styles from '@/Quests/components/quest-history/QuestHistoryCard.module.css';

type QuestHistoryCardProps = {
  quests: QuestView[];
  className?: string;
  activeTooltipId?: string | null;
  onTooltipToggle?: (nextTooltipId: string | null) => void;
  tooltipIdPrefix?: string;
};

// Displays quest badges using a controlled/uncontrolled tooltip pattern for reuse in page and isolated contexts.
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

  // Master quests are intentionally excluded because the page renders that tier as a separate chest indicator.
  const slots = quests.filter((q): q is QuestView => !!q && q.type !== QuestTypeValues.masterDailyQuests);

  useEffect(() => {
    if (!hasOpenTooltip) return;

    // Closes an open tooltip when the user clicks outside the badge/tooltip interaction boundary.
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
          const isIncomplete = !slotQuest.isCompleted;
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
