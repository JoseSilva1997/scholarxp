// Displays a module unit with status, title, edit, and dropdown for question groups; keeps interactions local for now.
import { useMemo, useState } from 'react';
import { RiDraftLine } from "react-icons/ri";
import { RiLock2Fill } from "react-icons/ri";
import { FaCheck } from "react-icons/fa6";
import { IconContext } from 'react-icons';
import styles from './ModuleUnitCard.module.css';
import ConfirmPublishModal from './Modals/ConfirmPublishModal';
import { useNavigate } from 'react-router-dom';

export type ModuleUnitStatus = 'draft' | 'live' | 'locked';

export type QuestionUnitGroup = {
  id: string;
  title: string;
  questions?: string[];
};

export type ModuleUnit = {
  id: string;
  title: string;
  status: ModuleUnitStatus;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const navigate = useNavigate();
  const moduleId = window.location.pathname.split('/')[3]; // crude but effective way to get moduleId from URL
  // Sum all questions across groups so the subtitle reflects actual question volume rather than group count.
  const totalQuestions = unit.questionGroups.reduce(
    (sum, group) => sum + (group.questions?.length ?? 0),
    0,
  );

  const statusIcon = {
    draft: <RiDraftLine/>,
    live: <FaCheck />,
    locked: <RiLock2Fill/>,
  }[unit.status];

  const editWarningCopy = useMemo(() => {
    // Tailor warning language by lifecycle so instructors understand student impact before entering editor.
    if (unit.status === 'live') {
      return {
        title: 'Edit live lesson?',
        body: 'This lesson is live. Changes can affect future student practice availability and question scope.',
        confirmLabel: 'Edit live lesson',
      };
    }
    if (unit.status === 'locked') {
      return {
        title: 'Edit locked lesson?',
        body: 'This lesson is locked. You can still update content before it goes live.',
        confirmLabel: 'Edit locked lesson',
      };
    }
    return {
      title: 'Edit draft lesson?',
      body: 'You are about to edit this draft lesson.',
      confirmLabel: 'Edit draft lesson',
    };
  }, [unit.status]);

  return (
    <div className={styles.wrapper}>
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
              <h3 className={styles.title}>{unit.title}</h3>
              <p className={styles.subtitle}>{totalQuestions} Questions</p>
            </div>
            <div className={styles.actions}>
              <button 
                type="button" 
                className={styles.editButton} 
                aria-label="Edit module unit"
                onClick={() => {
                  // Route transitions are gated by explicit confirmation so instructors see lifecycle warnings first.
                  setShowEditWarningModal(true);
                }}
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
        {unit.questionGroups.map((group) => (
          <div key={group.id} className={styles.group}>
            <p className={styles.groupTitle}>{group.title}</p>
            <div className={styles.questions}>
              {group.questions && group.questions.length > 0 ? (
                group.questions.map((q, idx) => (
                  <span key={idx} className={styles.question}>
                    {q}
                  </span>
                ))
              ) : (
                <span className={styles.empty}>No questions yet</span>
              )}
            </div>
          </div>
        ))}
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
        title={
          unit.status === 'draft'
            ? 'Ready to publish lesson?'
            : 'Go live?'
        }
        body={
          unit.status === 'draft'
            ? 'You can still edit it. Students will see its title but the contents will be locked until you set it live.'
            : 'This will make practice available to all students.'
        }
        confirmLabel={unit.status === 'draft' ? 'Publish' : 'Go live'}
      />

      <ConfirmPublishModal
        isOpen={showEditWarningModal}
        onCancel={() => setShowEditWarningModal(false)}
        onConfirm={() => {
          setShowEditWarningModal(false);
          navigate(`/main/modules/${moduleId}/${unit.id}/editor`);
        }}
        title={editWarningCopy.title}
        body={editWarningCopy.body}
        confirmLabel={editWarningCopy.confirmLabel}
      />
    </div>
  );
}
