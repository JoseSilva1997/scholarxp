// Dedicated quest badge tooltip component so card rendering stays focused on slot layout and interactions.
import { QuestTypeValues, type QuestView } from '@scholarxp/api-contracts';
import { motion } from 'motion/react';
import {
  BsBoxSeam,
  BsCheckCircleFill,
  BsClock,
  BsInfoCircle,
  BsJournalText,
  BsLightningChargeFill,
  BsTrophy,
  BsXCircleFill,
} from 'react-icons/bs';
import styles from '@/Quests/components/quest-history/QuestBadgeTooltip.module.css';

type QuestBadgeTooltipProps = {
  quest: QuestView;
};

export default function QuestBadgeTooltip({ quest }: QuestBadgeTooltipProps) {
  const todayUtc = new Date().toISOString().split('T')[0];
  const isPast = quest.questDateUtc < todayUtc;

  // Keep status derivation local so tooltip visuals always match quest completion/date rules.
  let statusLabel = 'Available';
  let statusIcon = <BsClock />;
  let statusClass = styles.statusAvailable;

  if (quest.isCompleted) {
    statusLabel = 'Quest Completed';
    statusIcon = <BsCheckCircleFill />;
    statusClass = styles.statusCompleted;
  } else if (isPast) {
    statusLabel = 'Quest Missed';
    statusIcon = <BsXCircleFill />;
    statusClass = styles.statusMissed;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95, translateX: '-50%' }}
      animate={{ opacity: 1, y: 0, scale: 1, translateX: '-50%' }}
      exit={{ opacity: 0, scale: 0.95, translateX: '-50%' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={styles.tooltip}
      role="tooltip"
      data-quest-tooltip="true"
    >
      <div className={styles.tooltipHeader}>
        <div className={`${styles.statusBadge} ${statusClass}`}>
          {statusIcon}
          <span>{statusLabel}</span>
        </div>
        {!quest.isCompleted && !isPast && (
          <div className={styles.expPreview}>
            <BsLightningChargeFill /> +{quest.expGranted}
          </div>
        )}
      </div>

      <div className={styles.tooltipBody}>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>
            <BsBoxSeam aria-hidden="true" /> Module:
          </span>{' '}
          <span className={styles.tooltipValue}>{quest.moduleTitle}</span>
        </div>

        {quest.type === QuestTypeValues.completeNewUnit && quest.moduleUnitTitle ? (
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>
              <BsJournalText aria-hidden="true" /> Lesson:
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
            <BsTrophy aria-hidden="true" /> Reward:
          </span>{' '}
          <span className={styles.expValue}>
            {quest.isCompleted ? (
              <>
                <BsCheckCircleFill aria-hidden="true" /> Received {quest.expGranted} XP
              </>
            ) : isPast ? (
              <span className={styles.missedExp}>
                <BsXCircleFill aria-hidden="true" /> Missed {quest.expGranted} XP
              </span>
            ) : (
              <>
                <BsLightningChargeFill aria-hidden="true" /> Earn {quest.expGranted} XP
              </>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
