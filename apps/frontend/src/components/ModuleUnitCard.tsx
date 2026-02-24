// Displays a module unit with status, title, edit, and dropdown for question groups; keeps interactions local for now.
import { useMemo, useState, useEffect } from 'react';
import { RiDraftLine, RiLock2Fill, RiArchiveFill, RiEditLine, RiCheckLine, RiCloseLine } from "react-icons/ri";
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
  onUpdateTitle?: (unitId: string, title: string) => Promise<void>;
};

export default function ModuleUnitCard({ unit, onChangeStatus, onUpdateTitle }: ModuleUnitCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(unit.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  useEffect(() => {
    // Sync local draft with server title whenever the unit prop updates and we are not actively editing.
    if (!isEditingTitle) {
      setEditedTitle(unit.title);
    }
  }, [unit.title, isEditingTitle]);

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

  /**
   * Persists the title change to the server and exits edit mode.
   * If the title is empty or unchanged, it reverts to the original title.
   */
  const handleSaveTitle = async () => {
    if (!onUpdateTitle || !editedTitle.trim() || editedTitle === unit.title) {
      setIsEditingTitle(false);
      setEditedTitle(unit.title);
      return;
    }

    setIsSavingTitle(true);
    try {
      await onUpdateTitle(unit.id, editedTitle.trim());
      setIsEditingTitle(false);
    } catch (err) {
      // Re-throw or handle error so UI can reflect failure if needed, 
      // though parent mutation handler usually logs this.
      console.error('Failed to update title', err);
    } finally {
      setIsSavingTitle(false);
    }
  };

  /**
   * Discards title changes and exits edit mode.
   */
  const handleCancelTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle(unit.title);
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
              {isEditingTitle ? (
                <div className={styles.titleContainer}>
                  <input
                    type="text"
                    className={styles.titleInput}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    disabled={isSavingTitle}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') handleCancelTitle();
                    }}
                  />
                  <button
                    type="button"
                    className={styles.saveTitleButton}
                    onClick={handleSaveTitle}
                    disabled={isSavingTitle || !editedTitle.trim()}
                    aria-label="Save title"
                  >
                    <RiCheckLine className={styles.titleIcon} />
                  </button>
                  <button
                    type="button"
                    className={styles.cancelTitleButton}
                    onClick={handleCancelTitle}
                    disabled={isSavingTitle}
                    aria-label="Cancel editing"
                  >
                    <RiCloseLine className={styles.titleIcon} />
                  </button>
                </div>
              ) : (
                <div className={styles.titleContainer}>
                  <h3 className={styles.title}>{unit.title}</h3>
                  {onUpdateTitle && (
                    <button
                      type="button"
                      className={styles.editTitleButton}
                      onClick={() => setIsEditingTitle(true)}
                      aria-label="Edit title"
                    >
                      <RiEditLine className={styles.titleIcon} />
                    </button>
                  )}
                </div>
              )}
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
        body={unit.status === 'draft' ? 
            "This moves the lesson to a locked state for final review. Students will be able to see it and its title, but can't see or interact with its the contents." 
          : "Students will be able to practice this lesson. Only go live when all content is ready."}
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
