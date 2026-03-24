// Student-facing module unit card; shows neutral badge and start practice CTA without edit or authoring controls.
import { useState } from 'react';
import styles from './StudentModuleUnitCard.module.css';
import completionMedalIcon from '../assets/module-unit/module-unit-completed-medal.png';
import { FaCheck, FaMinus, FaXmark, FaBolt, FaFire, FaGraduationCap } from 'react-icons/fa6';
import { TbTargetArrow } from "react-icons/tb";
import { IoMdLock } from "react-icons/io"
import XpStatCard from './XpStatCard';
import type { QuestionAttemptResult } from '@scholarxp/api-contracts';
import {
  MASTERY_TOTAL_EXP,
  MAXIMUM_FIRST_ATTEMPT_BONUS_EXP,
  MODULE_UNIT_BASELINE_EXP,
  STREAK_BONUS_EXP_PER_DELTA,
} from '@scholarxp/constants';

import type { ModuleUnit } from './ModuleUnitCard';
import DebugMeta from './DebugMeta';

type StudentModuleUnitCardProps = {
  unit: ModuleUnit;
  onOpenPracticeRoom?: (unitId: string, questionId?: string) => Promise<void> | void;
  onRetryPracticeRoom?: (unitId: string) => Promise<void> | void;
};

export default function StudentModuleUnitCard({
  unit,
  onOpenPracticeRoom,
  onRetryPracticeRoom,
}: StudentModuleUnitCardProps) {
  // Practice-room reward design currently has three streak thresholds; keep this explicit constant-driven total in one place.
  const maximumStreakBonusExp = STREAK_BONUS_EXP_PER_DELTA * 3;
  // Units with fewer than 4 questions don't qualify for streak bonuses (mirrors backend policy).
  const hasStreakBonus = unit.questionCount >= 4;
  const isLocked = unit.status === 'locked';
  // Store the initial completion state to prevent label flip-flops when refetching after navigation.
  // This ensures the button shows "View answers" for units that were completed at mount time,
  // even if the API returns different data after a page refresh/cache invalidation.
  const [initialIsCompleted] = useState(unit.isCompleted);
  // Use the memoized initial state rather than the potentially stale prop to determine button label.
  const practiceButtonLabel = initialIsCompleted ? 'View answers' : 'Start Practice';
  const [isOpen, setIsOpen] = useState(false);

  // Count successfully completed questions across all groups
  const completedQuestionsCount = unit.questionGroups.reduce((count, group) => {
    return count + (group.questions?.filter(q => q.lastAttemptResult === 'correct').length ?? 0);
  }, 0);

  const isFullyMastered = initialIsCompleted && completedQuestionsCount === unit.questionCount;

  const statusClass = isLocked 
    ? styles.locked 
    : isFullyMastered 
      ? styles.mastered 
      : initialIsCompleted 
        ? styles.completed 
        : styles.available;

  const renderQuestionStatusIcon = (lastAttemptResult: QuestionAttemptResult) => {
    if (lastAttemptResult === 'correct') {
      return <FaCheck className={`${styles.questionStatusIcon} ${styles.questionStatusCorrect}`} aria-hidden="true" />;
    }
    if (lastAttemptResult === 'incorrect') {
      return <FaXmark className={`${styles.questionStatusIcon} ${styles.questionStatusIncorrect}`} aria-hidden="true" />;
    }
    return <FaMinus className={`${styles.questionStatusIcon} ${styles.questionStatusUnattempted}`} aria-hidden="true" />;
  };

  return (
    <div className={`${styles.wrapper} ${statusClass}`}>
      <article className={styles.card}>
        <div className={styles.leftContainer} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.titleSection}>
              {/* Badge placeholder: displays lock when unit is locked, badge when completed */}
              <div className={styles.statusButton}>
                {initialIsCompleted ? (
                  // Completion medal is shown as soon as backend progress marks the unit complete.
                  <img
                    src={completionMedalIcon}
                    alt="Completion medal awarded"
                    className={`${styles.statusIconImage} ${styles.completionMedal}`}
                  />
                ) : isLocked ? (
                  <IoMdLock className={styles.lockedPadlockIcon} aria-hidden="true" />
                ) : null
                }
              </div>
              <div className={styles.meta}>
                <div className={styles.topRow}>
                  <span className={styles.categoryLabel}>Practice</span>
                  <span className={styles.statusTag}>
                    {isLocked ? 'Locked' : (isFullyMastered ? 'Complete' : (initialIsCompleted ? 'Resume' : 'Available'))}
                  </span>
                </div>
                <h3 className={styles.title}>{unit.title}</h3>
                <DebugMeta
                    entries={[
                        { label: 'unitId', value: unit.id },
                    ]}
                />
                <div className={styles.bottomRow}>
                  {unit.status === 'live' ? (
                     <span className={styles.engagementStat}>
                       <FaCheck className={styles.statIcon} />
                       {completedQuestionsCount}/{unit.questionCount} Questions
                     </span>
                  ) : null}
                  {isLocked && <span className={styles.lockedText}>Unlocks soon...</span>}
                </div>
              </div>
            </div>
            <div className={styles.middleMeta}>
                {!isLocked && (
                   <div className={styles.xpSummary} aria-label={unit.expEarned ? 'Earned XP rewards' : 'Possible XP rewards'}>
                     <div className={styles.xpMainTotal}>
                       <span className={styles.xpTotalValue}>
                         <span className={styles.xpSymbol}>⚡</span>
                         {unit.expEarned
                           ? (unit.expEarned.base + unit.expEarned.firstAttempt + unit.expEarned.streak + unit.expEarned.mastery)
                           : (MODULE_UNIT_BASELINE_EXP + MAXIMUM_FIRST_ATTEMPT_BONUS_EXP + (hasStreakBonus ? maximumStreakBonusExp : 0) + MASTERY_TOTAL_EXP)
                         }
                       </span>
                       <span className={styles.xpTotalSubtext}>
                         {unit.expEarned
                           ? `of ${MODULE_UNIT_BASELINE_EXP + MAXIMUM_FIRST_ATTEMPT_BONUS_EXP + (hasStreakBonus ? maximumStreakBonusExp : 0) + MASTERY_TOTAL_EXP} XP`
                           : 'AVAILABLE'}
                       </span>
                     </div>
                     
                     <div className={styles.xpStatsList}>
                       <XpStatCard
                         label="Base"
                         current={unit.expEarned?.base ?? 0}
                         max={MODULE_UNIT_BASELINE_EXP}
                         title="Base XP gained when a question is answered correctly."
                         colorClass="colorBase"
                         icon={<FaBolt />}
                       />

                       <XpStatCard
                         label="1st try"
                         current={unit.expEarned?.firstAttempt ?? 0}
                         max={MAXIMUM_FIRST_ATTEMPT_BONUS_EXP}
                         title="Bonus XP for first-try correct answers"
                         colorClass="colorFirst"
                         icon={<TbTargetArrow />}
                       />

                       {hasStreakBonus && (
                         <XpStatCard
                           label="Streak"
                           current={unit.expEarned?.streak ?? 0}
                           max={maximumStreakBonusExp}
                           title="Bonus XP for maintaining a streak"
                           colorClass="colorStreak"
                           icon={<FaFire />}
                         />
                       )}

                       <XpStatCard
                         label="Mastery"
                         current={unit.expEarned?.mastery ?? 0}
                         max={MASTERY_TOTAL_EXP}
                         title="XP earned through daily practice mastery"
                         colorClass="colorMastery"
                         icon={<FaGraduationCap />}
                       />
                     </div>
                   </div>
                )}
            </div>
            <div className={styles.actions}>
              <div className={styles.actionStack}>
                <button 
                  type="button" 
                  className={styles.practiceButton} 
                  aria-label={practiceButtonLabel}
                  disabled={isLocked}
                  onClick={() => {
                    // Navigation and quest-trigger orchestration live above the card so this component stays render-focused.
                    void onOpenPracticeRoom?.(unit.id);
                  }}
                >
                  {practiceButtonLabel}
                </button>
                {initialIsCompleted && (
                  <button
                    type="button"
                    className={styles.retryButton}
                    aria-label="Retry"
                    disabled={isLocked}
                    onClick={() => {
                      // Retry entry is lesson-level only so per-question buttons can stay mapped to review mode.
                      void onRetryPracticeRoom?.(unit.id);
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {!isLocked && (
          <div className={styles.rightContainer}>
            <button
              type="button"
              className={styles.dropdownButton}
              aria-expanded={isOpen}
              aria-controls={`student-unit-panel-${unit.id}`}
              aria-label={isOpen ? 'Collapse lesson details' : 'Expand lesson details'}
              onClick={() => setIsOpen((open) => !open)}
            >
              <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true" />
            </button>
          </div>
        )}
      </article>
      {!isLocked && (
        <div
          className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
          id={`student-unit-panel-${unit.id}`}
          aria-hidden={!isOpen}
        >
          {unit.questionGroups.length > 0 ? (
            unit.questionGroups.map((group) => (
              <div key={group.id} className={styles.group}>
                <p className={styles.groupTitle}>{group.title}</p>
                <div className={styles.questions}>
                  {group.questions && group.questions.length > 0 ? (
                    group.questions.map((question) => (
                      <button
                        key={question.id}
                        type="button"
                        className={styles.question}
                        disabled={isLocked}
                        aria-label={`Practice ${question.title}`}
                        onClick={() => {
                          // Detail buttons delegate routing so the page-state hook can keep practice-room entry behavior centralized.
                          void onOpenPracticeRoom?.(unit.id, question.id);
                        }}
                      >
                        <span className={styles.questionTitle}>{question.title}</span>
                        {/* Status icon mirrors latest attempt state so students can scan completion quickly. */}
                        <span
                          className={styles.questionStatus}
                          data-testid={`question-status-${question.id}`}
                        >
                          {renderQuestionStatusIcon(question.lastAttemptResult ?? null)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <span className={styles.empty}>No questions available in this group</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.empty}>This unit doesn't have any question groups yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
