// Displays a module unit with status, title, edit, and dropdown for question groups; keeps interactions local for now.
import { useState } from 'react';
import draftIcon from '../assets/module-unit/module-unit-draft-white.svg';
import checkIcon from '../assets/module-unit/module-unit-live-checkmark-white.svg';
import lockIcon from '../assets/module-unit/module-unit-padlock-white.svg';
import styles from './ModuleUnitCard.module.css';

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
};

export default function ModuleUnitCard({ unit }: ModuleUnitCardProps) {
  const [isOpen, setIsOpen] = useState(false);

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
    </div>
  );
}
