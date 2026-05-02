// Displays a module unit with status, title, edit, and dropdown for question groups; keeps interactions local for now.
import { useMemo, useState, useEffect, useRef } from 'react';
import { RiEditLine, RiCheckLine, RiCloseLine, RiArrowDownSLine } from "react-icons/ri";
import { FaCheck } from "react-icons/fa6";
import styles from '@/Authoring/SingleModule/components/ModuleUnitCard.module.css';
import ConfirmPublishModal from '@/Authoring/SingleModule/components/ConfirmPublishModal';
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
  expEarned?: { base: number; firstAttempt: number; streak: number; mastery: number };
};

type ModuleUnitCardProps = {
  unit: ModuleUnit;
  onChangeStatus?: (unitId: string, status: ModuleUnitStatus) => Promise<void>;
  onUpdateTitle?: (unitId: string, title: string) => Promise<void>;
};

const STATUS_DISPLAY_LABELS: Record<ModuleUnitStatus, string> = {
  draft: 'Draft',
  locked: 'Locked',
  live: 'Live',
  archived: 'Archived',
};

// Both publish steps deserve confirmation because each one changes what students can see or do.
const MODAL_REQUIRED_TRANSITIONS: Partial<Record<ModuleUnitStatus, Set<ModuleUnitStatus>>> = {
  draft: new Set(['locked']),
  locked: new Set(['live']),
};

// Statuses available in the dropdown menu — archived is managed separately (not in-line).
const MENU_STATUSES: ModuleUnitStatus[] = ['draft', 'locked', 'live'];

// Which target statuses are valid from a given source — keeps the menu honest about supported paths.
const VALID_TRANSITIONS: Record<ModuleUnitStatus, Set<ModuleUnitStatus>> = {
  draft: new Set(['locked']),
  locked: new Set(['draft', 'live']),
  live: new Set(),
  archived: new Set(),
};

// Renders tutor-facing unit controls including editing, status transitions, and grouped question shortcuts.
export default function ModuleUnitCard({ unit, onChangeStatus, onUpdateTitle }: ModuleUnitCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(unit.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  // Target status held while a confirmation modal is open — applied on confirm.
  const [pendingTargetStatus, setPendingTargetStatus] = useState<ModuleUnitStatus | null>(null);

  useEffect(() => {
    // Sync local draft with server title whenever the unit prop updates and we are not actively editing.
    if (!isEditingTitle) {
      setEditedTitle(unit.title);
    }
  }, [unit.title, isEditingTitle]);

  useEffect(() => {
    if (!isStatusMenuOpen) return;
    // Closes the status menu when focus moves outside the dropdown region.
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStatusMenuOpen]);

  const [showEditWarningModal, setShowEditWarningModal] = useState(false);
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const navigate = useNavigate();
  const totalQuestions = unit.questionCount;

  const statusClass = styles[unit.status] || '';
  const isOverlayOpen = showPublishModal || showEditWarningModal;

  // Builds the editor route from the current module URL and optionally focuses a selected question.
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

  const publishModalCopy = useMemo(() => {
    if (pendingTargetStatus === 'locked') {
      return {
        title: 'Ready to publish lesson?',
        body: "This moves the lesson to a locked state for final review. Students will be able to see it and its title, but can't see or interact with its contents.",
        confirmLabel: 'Publish to Locked',
      };
    }

    return {
      title: 'Go live?',
      body: 'Students will be able to practice this lesson. Only go live when all content is ready.',
      confirmLabel: 'Go Live',
    };
  }, [pendingTargetStatus]);

  // Starts editing immediately for non-live content, or requires warning confirmation for live lessons.
  const onTryEdit = (questionId: string | null = null) => {
    // Skip warning for drafts and locked units; only live content requires confirmation before editing.
    if (unit.status !== 'live') {
      navigateToEditor(questionId);
      return;
    }
    setPendingQuestionId(questionId);
    setShowEditWarningModal(true);
  };

  // Applies direct status moves or opens confirmation for transitions that affect student visibility.
  const handleStatusSelect = async (targetStatus: ModuleUnitStatus) => {
    setIsStatusMenuOpen(false);
    if (targetStatus === unit.status || !onChangeStatus) return;

    const needsModal = MODAL_REQUIRED_TRANSITIONS[unit.status]?.has(targetStatus) ?? false;

    if (needsModal) {
      setPendingTargetStatus(targetStatus);
      setShowPublishModal(true);
      return;
    }

    // Any remaining direct transition is an internal authoring move, so it does not need extra confirmation.
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onChangeStatus(unit.id, targetStatus);
    } catch (err) {
      console.error('Status change failed', err);
      setActionError('Failed to update status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Completes the pending confirmed status transition and clears modal state.
  const handleConfirmModalAction = async () => {
    if (!onChangeStatus || !pendingTargetStatus) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onChangeStatus(unit.id, pendingTargetStatus);
      setShowPublishModal(false);
      setPendingTargetStatus(null);
    } catch (err) {
      console.error('Status transition failed', err);
      setActionError('Failed to update status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Persists a non-empty changed title, otherwise reverts to the current server-backed title.
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

  // Discards draft title edits and restores the displayed unit title.
  const handleCancelTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle(unit.title);
  };

  const canChangeStatus = !!onChangeStatus && unit.status !== 'archived';

  return (
    <div className={`${styles.wrapper} ${statusClass} ${isOverlayOpen ? styles.modalOpen : ''} ${isStatusMenuOpen ? styles.statusMenuOpen : ''}`}>
      <article className={styles.card}>
        <div className={styles.leftContainer} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.meta}>
              <div className={styles.topRow}>
                <span className={styles.categoryLabel}>Lesson</span>
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
              </div>
            </div>

            <div className={styles.actions}>

              <button
                type="button"
                className={styles.editButton}
                aria-label="Edit module unit"
                onClick={() => onTryEdit()}
              >
                <RiEditLine className={styles.editButtonIcon} aria-hidden="true" />
                Edit
              </button>
                            {/* Status dropdown — grouped with Edit so all controls are on the right */}
              <div className={styles.statusDropdown} ref={statusDropdownRef}>
                <button
                  type="button"
                  className={styles.statusTrigger}
                  aria-label={`Lesson status: ${unit.status}`}
                  aria-haspopup="listbox"
                  aria-expanded={isStatusMenuOpen}
                  disabled={!canChangeStatus || isSubmitting}
                  onClick={() => setIsStatusMenuOpen((v) => !v)}
                >
                  <span className={styles.statusTriggerDot} aria-hidden="true" />
                  <span>{STATUS_DISPLAY_LABELS[unit.status]}</span>
                  <RiArrowDownSLine className={styles.statusTriggerCaret} aria-hidden="true" />
                </button>

                {isStatusMenuOpen && (
                  <ul
                    className={styles.statusMenu}
                    role="listbox"
                    aria-label="Choose lesson status"
                  >
                    {MENU_STATUSES.map((s) => {
                      const isCurrent = s === unit.status;
                      const isValid = VALID_TRANSITIONS[unit.status].has(s);
                      return (
                        <li key={s} role="option" aria-selected={isCurrent}>
                          <button
                            type="button"
                            className={`${styles.statusMenuItem} ${isCurrent ? styles.statusMenuItemCurrent : ''} ${!isCurrent && !isValid ? styles.statusMenuItemDisabled : ''}`}
                            disabled={isCurrent || !isValid}
                            onClick={() => { void handleStatusSelect(s); }}
                          >
                            <span className={`${styles.statusMenuDot} ${styles[`dot_${s}`]}`} aria-hidden="true" />
                            <span className={styles.statusMenuLabel}>{STATUS_DISPLAY_LABELS[s]}</span>
                            {isCurrent && <RiCheckLine className={styles.statusMenuCheck} aria-hidden="true" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
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
          unit.questionGroups.map((group) => {
            // Count from preview data rather than total unit count so each group badge reflects its own content.
            const groupQuestionCount = (group.questions ?? []).length;
            return (
              <div key={group.id} className={styles.group}>
                <p className={styles.groupTitle}>
                  {group.title}
                  <span className={styles.groupBadge}>
                    · {groupQuestionCount} {groupQuestionCount === 1 ? 'question' : 'questions'}
                  </span>
                </p>
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
            );
          })
        ) : (
          <div className={styles.empty}>This unit has no question groups.</div>
        )}
      </div>

      {/* locked → live: immediately affects student access — modal is intentional friction */}
      <ConfirmPublishModal
        isOpen={showPublishModal}
        onCancel={() => { setShowPublishModal(false); setPendingTargetStatus(null); }}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmModalAction}
        errorMessage={actionError ?? undefined}
        title={publishModalCopy.title}
        body={publishModalCopy.body}
        confirmLabel={publishModalCopy.confirmLabel}
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
