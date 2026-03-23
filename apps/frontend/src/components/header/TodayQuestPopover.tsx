import { Link } from 'react-router-dom';
import { type QuestView, QuestTypeValues } from '@scholarxp/api-contracts';
import { MASTER_QUEST_COMPLETION_REWARD } from '@scholarxp/constants';
import { AnimatePresence, motion } from 'motion/react';
import { useState, useMemo } from 'react';
import {
  BsBoxSeam,
  BsCheckCircleFill,
  BsChevronRight,
  BsInfoCircle,
  BsJournalText,
  BsLightningChargeFill,
  BsTrophyFill,
} from 'react-icons/bs';
import { GiLockedChest, GiOpenTreasureChest } from 'react-icons/gi';
import { getQuestBadge } from '@/constants/quest-constants';
import styles from './TodayQuestPopover.module.css';

type TodayQuestPopoverProps = {
  id: string;
  quests: QuestView[];
  masterQuest: QuestView | null;
  completed: number;
  max: number;
  hasDailyQuests: boolean;
  isLoading: boolean;
  onNavigateToHistory?: () => void;
};

export default function TodayQuestPopover({
  id,
  quests,
  masterQuest,
  completed,
  max,
  hasDailyQuests,
  isLoading,
  onNavigateToHistory,
}: TodayQuestPopoverProps) {
  const [selectedQuestId, setSelectedQuestId] = useState<number | null>(null);

  // Initialize selected quest to the first incomplete one or simply the first one.
  const activeQuestId = useMemo(() => {
    if (selectedQuestId !== null) return selectedQuestId;
    return quests.find((q) => !q.isCompleted)?.id ?? quests[0]?.id ?? null;
  }, [quests, selectedQuestId]);

  const selectedQuest = quests.find((q) => q.id === activeQuestId);
  const progressPercentage = max > 0 ? (completed / max) * 100 : 0;
  const MasterQuestIcon = masterQuest?.isCompleted
    ? GiOpenTreasureChest
    : GiLockedChest;
  const masterRewardBreakdown = masterQuest?.rewardBreakdown;
  const displayedMasterReward =
    masterRewardBreakdown?.totalExp ??
    masterQuest?.expGranted ??
    MASTER_QUEST_COMPLETION_REWARD;

  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={styles.popover}
      data-testid="today-quest-popover"
    >
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <BsTrophyFill className={styles.headerIcon} />
          <h2 className={styles.title}>Today&apos;s Quests</h2>
        </div>
        {hasDailyQuests ? (
          <div className={styles.progressContainer}>
            <div
              className={`${styles.masterQuestBadge} ${
                masterQuest?.isCompleted
                  ? styles.masterQuestBadgeComplete
                  : styles.masterQuestBadgeIncomplete
              }`.trim()}
              aria-label={
                masterQuest?.isCompleted
                  ? 'Master quest completed'
                  : 'Master quest incomplete'
              }
              title={
                masterQuest?.description ??
                'Complete all daily quests to unlock the master quest reward.'
              }
            >
              <MasterQuestIcon className={styles.masterQuestIcon} aria-hidden="true" />
            </div>
            <div className={styles.progressDetails}>
              <div className={styles.progressText}>
                <span>Progress</span>
                <span>{completed}/{max}</span>
              </div>
              <div className={styles.progressBar}>
                <motion.div
                  className={styles.progressFill}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
              </div>
              <div className={styles.masterQuestInfo}>
                <span className={styles.rewardHint}>
                  {masterQuest?.isCompleted ? 'Awarded' : 'Completing all quests today grants'}
                  <span className={styles.expBadge}>
                    <BsLightningChargeFill /> +{displayedMasterReward}
                  </span>
                </span>
                {masterRewardBreakdown ? (
                  <span className={styles.rewardHint}>
                    +{masterRewardBreakdown.baseExp} Base, +
                    {masterRewardBreakdown.streakBonusExp} Streak bonus
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.placeholder}>
            <div className={styles.spinner} />
            <p>Loading quests...</p>
          </div>
        ) : null}

        {!isLoading && !hasDailyQuests ? (
          <div className={styles.placeholder}>
            <p><BsBoxSeam className={styles.emptyIcon} />
              You don&apos;t have any daily quests yet.
              </p>
              <br />
            <p>Quests will unlock the day after you join a module and complete your first lesson.</p>
          </div>
        ) : null}

        {!isLoading && hasDailyQuests ? (
          <div className={styles.mainLayout}>
            <div className={styles.slotRow}>
              {quests.map((quest) => (
                <button
                  key={quest.id}
                  className={`
                    ${styles.slot} 
                    ${quest.id === activeQuestId ? styles.activeSlot : ''} 
                    ${!quest.isCompleted ? styles.incompleteSlot : ''}
                  `.trim()}
                  onClick={() => setSelectedQuestId(quest.id)}
                  aria-label={`View details for ${quest.moduleTitle} quest`}
                  aria-pressed={quest.id === activeQuestId}
                >
                  <img
                    src={getQuestBadge(quest)}
                    alt=""
                    className={styles.badge}
                  />
                  {quest.isCompleted && (
                    <BsCheckCircleFill className={styles.slotCheck} />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {selectedQuest && (
                <motion.div
                  key={selectedQuest.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className={styles.selectedQuestCard}
                >
                  <div className={styles.cardHeader}>
                    <h3 className={styles.moduleName}>{selectedQuest.moduleTitle}</h3>
                    <span className={styles.expBadge}>
                      <BsLightningChargeFill /> +{selectedQuest.expGranted}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>
                        <BsInfoCircle aria-hidden="true" /> Info:
                      </span>
                      <p className={styles.description}>{selectedQuest.description}</p>
                    </div>

                    {selectedQuest.type === QuestTypeValues.completeNewUnit && selectedQuest.moduleUnitTitle ? (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>
                          <BsJournalText aria-hidden="true" /> Lesson:
                        </span>
                        <p className={styles.description}>{selectedQuest.moduleUnitTitle}</p>
                      </div>
                    ) : null}
                  </div>

                  {selectedQuest.isCompleted ? (
                    <div className={styles.completedBanner}>
                        <BsCheckCircleFill aria-hidden="true" /> Reward Received
                    </div>
                  ) : (
                    <div className={styles.pendingBanner}>
                         Quest in Progress
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      <footer className={styles.footer}>
        <Link
          to="/main/quests"
          className={styles.historyLink}
          onClick={() => onNavigateToHistory?.()}
        >
          Check quest history <BsChevronRight />
        </Link>
      </footer>
    </motion.section>
  );
}
