// Displays a module unit with status, title, edit, and dropdown for question groups; keeps interactions local for now.
import { useState } from 'react';
import draftIcon from '../assets/module-unit/module-unit-draft-white.svg';
import checkIcon from '../assets/module-unit/module-unit-live-checkmark-white.svg';
import lockIcon from '../assets/module-unit/module-unit-padlock-white.svg';
import styles from './ModuleUnitCard.module.css';
import ConfirmPublishModal from './Modals/ConfirmPublishModal';

type ModuleUnitStatus = 'draft' | 'live' | 'locked';

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
  onPublish?: (unitId: string) => Promise<void>;
};

export default function ModuleUnitCard({ unit, onPublish }: ModuleUnitCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const statusIcon = {
    draft: draftIcon,
    live: checkIcon,
    locked: lockIcon,
  }[unit.status];

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
                if (unit.status === 'draft' && onPublish) {
                  setShowPublishModal(true);
                }
              }}
            >
              <img src={statusIcon} alt="" aria-hidden="true" />
            </button>
            <div className={styles.meta}>
              <h3 className={styles.title}>{unit.title}</h3>
              <p className={styles.subtitle}>{unit.questionGroups.length} Questions</p>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.editButton} aria-label="Edit module unit">
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
          if (!onPublish) return;
          setIsSubmitting(true);
          setPublishError(null);
          try {
            await onPublish(unit.id);
            setShowPublishModal(false);
          } catch (err) {
            console.error('Publish module unit failed', err);
            setPublishError('Failed to publish. Please try again.');
          } finally {
            setIsSubmitting(false);
          }
        }}
        errorMessage={publishError ?? undefined}
      />
    </div>
  );
}
