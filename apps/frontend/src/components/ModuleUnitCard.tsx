// Displays a module unit with status, title, edit, and dropdown for question groups; keeps interactions local for now.
import { useMemo, useState } from 'react';
import { RiDraftLine, RiLock2Fill, RiArchiveFill } from "react-icons/ri";
import { FaCheck } from "react-icons/fa6";
import { IconContext } from 'react-icons';
import styles from './ModuleUnitCard.module.css';
import ConfirmPublishModal from './Modals/ConfirmPublishModal';
import { useNavigate } from 'react-router-dom';
import type { ModuleUnitStatus, QuestionAttemptResult } from '@scholarxp/api-contracts';

export type { ModuleUnitStatus } from '@scholarxp/api-contracts';

export type ModuleUnitQuestionPreview = {
  id: string;
  title: string;
  lastAttemptResult?: QuestionAttemptResult;
};

export type QuestionUnitGroup = {
  id: string;
  title: string;
  questions?: ModuleUnitQuestionPreview[];
};

export type ModuleUnit = {
  id: string;
  title: string;
  status: ModuleUnitStatus;
  questionCount: number;
  isCompleted: boolean;
  questionGroups: QuestionUnitGroup[];
};

type ModuleUnitCardProps = {
  unit: ModuleUnit;
  onChangeStatus?: (unitId: string, status: ModuleUnitStatus) => Promise<void>;
};

export default function ModuleUnitCard({ unit, onChangeStatus }: ModuleUnitCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showEditWarningModal, setShowEditWarningModal] = useState(false);
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const navigate = useNavigate();
  const totalQuestions = unit.questionCount;

  const statusIcon = {
    draft: <RiDraftLine/>,
    live: <FaCheck />,
    locked: <RiLock2Fill/>,
    archived: <RiArchiveFill />,
  }[unit.status];

  const statusClass = styles[unit.status] || '';
  const isOverlayOpen = showPublishModal || showEditWarningModal;

  const navigateToEditor = (questionId: string | null = null) => {
    const moduleId = window.location.pathname.split('/')[3];
    const path = questionId 
      ? `/main/modules/${moduleId}/${unit.id}/editor?questionId=${encodeURIComponent(questionId)}`
      : `/main/modules/${moduleId}/${unit.id}/editor`;
    navigate(path);
  };

  const editWarningCopy = useMemo(() => {
    // Only used for live lessons to warn about student impact.
    return {
      title: 'Edit live lesson?',
      body: 'This lesson is live. Changes can affect future student practice availability and progress tracking.',
      confirmLabel: 'Edit live lesson',
    };
  }, []);

  const onTryEdit = (questionId: string | null = null) => {
    // Skip warning for drafts and locked units; only live content requires confirmation before editing.
    if (unit.status !== 'live') {
      navigateToEditor(questionId);
      return;
    }
    setPendingQuestionId(questionId);
    setShowEditWarningModal(true);
  };

  return (
    <div className={`${styles.wrapper} ${statusClass} ${isOverlayOpen ? styles.modalOpen : ''}`}>
      <article className={styles.card}>
        <div className={styles.leftContainer} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.header}>
            <button
              type="button"
              className={styles.statusButton}
              aria-label={`Module unit status: ${unit.status}`}
              title={`Module unit status: ${unit.status}`}
              onClick={() => {
                if ((unit.status === 'draft' || unit.status === 'locked') && onChangeStatus) {
                  setShowPublishModal(true);
                }
              }}
            >
              <IconContext.Provider value={{className: styles.statusIcon}}>
                 {statusIcon}
              </IconContext.Provider>
            </button>
            <div className={styles.meta}>
              <div className={styles.topRow}>
                <span className={styles.categoryLabel}>Unit</span>
                <span className={styles.statusTag}>{unit.status}</span>
              </div>
              <h3 className={styles.title}>{unit.title}</h3>
              <div className={styles.bottomRow}>
                <span className={styles.engagementStat}>
                  <FaCheck className={styles.statIcon} />
                  {totalQuestions} {totalQuestions === 1 ? 'Question' : 'Questions'}
                </span>
                <span className={styles.lockedText}>Status: {unit.status.charAt(0).toUpperCase() + unit.status.slice(1)}</span>
              </div>
            </div>
            <div className={styles.actions}>
              <button 
                type="button" 
                className={styles.editButton} 
                aria-label="Edit module unit"
                onClick={() => onTryEdit()}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
        <div className={styles.rightContainer}>
          <button
            type="button"
            className={styles.dropdownButton}
            aria-expanded={isOpen}
            aria-controls={`unit-panel-${unit.id}`}
            aria-label={isOpen ? 'Collapse question groups' : 'Expand question groups'}
            onClick={() => setIsOpen((open) => !open)}
          >
            <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true" />
          </button>
        </div>
      </article>

      <div
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        id={`unit-panel-${unit.id}`}
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
                      onClick={() => onTryEdit(question.id)}
                      aria-label={`Edit ${question.title}`}
                    >
                      {question.title}
                    </button>
                  ))
                ) : (
                  <span className={styles.empty}>No questions yet</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.empty}>This unit has no question groups.</div>
        )}
      </div>

      <ConfirmPublishModal
        isOpen={showPublishModal}
        onCancel={() => setShowPublishModal(false)}
        isSubmitting={isSubmitting}
        onConfirm={async () => {
          if (!onChangeStatus) return;
          setIsSubmitting(true);
          setPublishError(null);
          try {
            const targetStatus = unit.status === 'draft' ? 'locked' : 'live';
            await onChangeStatus(unit.id, targetStatus);
            setShowPublishModal(false);
          } catch (err) {
            console.error('Publish module unit failed', err);
            setPublishError('Failed to publish. Please try again.');
          } finally {
            setIsSubmitting(false);
          }
        }}
        errorMessage={publishError ?? undefined}
        title={unit.status === 'draft' ? 'Ready to publish lesson?' : 'Go live?'}
        body={unit.status === 'draft' ? 'This moves the unit to a locked state for final review.' : 'Live units are visible to students.'}
        confirmLabel={unit.status === 'draft' ? 'Publish to Locked' : 'Go Live'}
      />

      <ConfirmPublishModal
        isOpen={showEditWarningModal}
        title={editWarningCopy.title}
        body={editWarningCopy.body}
        confirmLabel={editWarningCopy.confirmLabel}
        onCancel={() => setShowEditWarningModal(false)}
        onConfirm={() => {
          setShowEditWarningModal(false);
          navigateToEditor(pendingQuestionId);
        }}
      />
    </div>
  );
}
