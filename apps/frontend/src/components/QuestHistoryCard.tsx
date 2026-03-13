// Reusable quest history day card that renders a dynamic hex layout based on available quests.
import { QuestTypeValues, type QuestView } from '@scholarxp/api-contracts';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { BsHexagon } from 'react-icons/bs';
import { GiLockedChest, GiOpenTreasureChest } from 'react-icons/gi';
import { getQuestBadge } from '../constants/quest-constants';
import QuestBadgeTooltip from './QuestBadgeTooltip';
import styles from './QuestHistoryCard.module.css';

type QuestHistoryCardProps = {
  quests: QuestView[];
  masterQuest?: QuestView | null;
  className?: string;
  activeTooltipId?: string | null;
  onTooltipToggle?: (nextTooltipId: string | null) => void;
  tooltipIdPrefix?: string;
};

export default function QuestHistoryCard({
  quests,
  masterQuest = null,
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

  // Render exactly the number of quests provided; no hardcoded slot count.
  const slots = quests.filter((q): q is QuestView => !!q && q.type !== QuestTypeValues.masterDailyQuests);
  const MasterQuestIcon = masterQuest?.isCompleted
    ? GiOpenTreasureChest
    : GiLockedChest;

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
          // Daily quest slots keep badge treatment while the master quest gets a separate chest marker.
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
        {masterQuest ? (
          <div
            className={`${styles.slot} ${styles.masterQuestSlot} ${
              masterQuest.isCompleted ? styles.masterQuestComplete : styles.masterQuestIncomplete
            }`.trim()}
            aria-label={
              masterQuest.isCompleted
                ? 'Master quest completed'
                : 'Master quest incomplete'
            }
            role="img"
            title={masterQuest.description}
          >
            <MasterQuestIcon className={styles.masterQuestIcon} aria-hidden="true" />
          </div>
        ) : (
          // Legacy days without a generated master quest keep the layout balanced with a neutral placeholder.
          <div className={`${styles.slot} ${styles.masterQuestSlot}`.trim()} aria-hidden="true">
            <BsHexagon className={styles.emptyIcon} />
          </div>
        )}
      </div>
    </div>
  );
}
