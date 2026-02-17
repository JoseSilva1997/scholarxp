// Student-facing module unit card; shows neutral badge and start practice CTA without edit or authoring controls.
import { useRef, useState } from 'react';
import styles from './StudentModuleUnitCard.module.css';
import lockIcon from '../assets/module-unit/student-module-unit-padlock.svg';
import completionMedalIcon from '../assets/module-unit/module-unit-completed-medal.png';
import { FaCheck, FaMinus, FaXmark } from 'react-icons/fa6';
import type { QuestionAttemptResult } from '@scholarxp/api-contracts';

import type { ModuleUnit } from './ModuleUnitCard';

type StudentModuleUnitCardProps = {
  unit: ModuleUnit;
};

export default function StudentModuleUnitCard({ unit }: StudentModuleUnitCardProps) {
  const isLocked = unit.status === 'locked';
  // Store the initial completion state to prevent label flip-flops when refetching after navigation.
  // This ensures the button shows "View answers" for units that were completed at mount time,
  // even if the API returns different data after a page refresh/cache invalidation.
  const initialIsCompletedRef = useRef(unit.isCompleted);
  // Use the memoized initial state rather than the potentially stale prop to determine button label.
  const practiceButtonLabel = initialIsCompletedRef.current ? 'View answers' : 'Start Practice';
  const [isOpen, setIsOpen] = useState(false);
  const moduleId = window.location.pathname.split('/')[3];
  const basePracticeRoomPath = `/main/modules/${moduleId}/${unit.id}/practice-room`;

  // Count successfully completed questions across all groups
  const completedQuestionsCount = unit.questionGroups.reduce((count, group) => {
    return count + (group.questions?.filter(q => q.lastAttemptResult === 'correct').length ?? 0);
  }, 0);

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
    <div className={styles.wrapper}>
      <article className={styles.card}>
        <div className={styles.leftContainer} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.header}>
            {/* Badge placeholder: displays lock when unit is locked, badge when completed */}
            <div className={styles.statusButton}>
              {initialIsCompletedRef.current ? (
                // Completion medal is shown as soon as backend progress marks the unit complete.
                <img
                  src={completionMedalIcon}
                  alt="Completion medal awarded"
                  className={`${styles.statusIconImage} ${styles.completionMedal}`}
                />
              ) : isLocked ? (
                <img
                  src={lockIcon}
                  alt=""
                  aria-hidden="true"
                  className={styles.statusIconImage}
                />
              ) : null}
            </div>
            <div className={styles.meta}>
              <h3 className={styles.title}>{unit.title}</h3>
              {/* Only live units expose question totals; locked units stay title-only until practice is available. */}
              {unit.status === 'live' ? (
                <p className={styles.subtitle}>
                  {completedQuestionsCount}/{unit.questionCount} {unit.questionCount === 1 ? 'Question' : 'Questions'}
                </p>
              ) : null}
            </div>
            <div className={styles.actions}>
              <button 
                type="button" 
                className={styles.practiceButton} 
                aria-label={practiceButtonLabel}
                disabled={isLocked}
                onClick={() => {
                  // Full-path assignment keeps this card router-agnostic for tests while still opening the practice room.
                  window.location.assign(basePracticeRoomPath);
                }}
              >
                {practiceButtonLabel}
              </button>
            </div>
          </div>
        </div>
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
      </article>
      <div
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        id={`student-unit-panel-${unit.id}`}
        aria-hidden={!isOpen}
      >
        {unit.questionGroups.map((group) => (
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
                      // Deep-link to a question unit so students can resume from the entry they selected in the card.
                      window.location.assign(
                        `${basePracticeRoomPath}?questionId=${encodeURIComponent(question.id)}`,
                      );
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
                <span className={styles.empty}>No questions yet</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
