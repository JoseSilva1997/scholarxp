// Student-facing module unit card; shows neutral badge and start practice CTA without edit or authoring controls.
import { useState } from 'react';
import styles from './StudentModuleUnitCard.module.css';
import lockIcon from '../assets/module-unit/student-module-unit-padlock.svg';

import type { ModuleUnit } from './ModuleUnitCard';

type StudentModuleUnitCardProps = {
  unit: ModuleUnit;
};

export default function StudentModuleUnitCard({ unit }: StudentModuleUnitCardProps) {
  const isLocked = unit.status === 'locked';
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <article className={styles.card}>
        <div className={styles.leftContainer} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.header}>
            {/* Badge placeholder: displays lock when unit is locked, badge when completed */}
            <div className={styles.statusButton}>
              {isLocked ? <img src={lockIcon} alt="" aria-hidden="true" /> : null}
            </div>
            <div className={styles.meta}>
              <h3 className={styles.title}>{unit.title}</h3>
            </div>
            <div className={styles.actions}>
              <button 
                type="button" 
                className={styles.practiceButton} 
                aria-label="Start practice"
                disabled={isLocked}
              >
                Start Practice
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
