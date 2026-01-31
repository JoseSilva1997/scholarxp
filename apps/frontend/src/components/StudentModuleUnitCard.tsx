// Student-facing module unit card; shows neutral badge and start practice CTA without edit or authoring controls.
import styles from './StudentModuleUnitCard.module.css';
import lockIcon from '../assets/module-unit/student-module-unit-padlock.svg';

import type { ModuleUnit } from './ModuleUnitCard';

type StudentModuleUnitCardProps = {
  unit: ModuleUnit;
};

export default function StudentModuleUnitCard({ unit }: StudentModuleUnitCardProps) {
  const isLocked = unit.status === 'locked';

  return (
    <div className={styles.wrapper}>
      <article className={styles.card}>
        <div className={styles.leftContainer} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.header}>
            <button
              type="button"
              className={styles.statusButton}
              aria-label={isLocked ? 'Locked' : 'Available'}
              title={isLocked ? 'Locked' : 'Available'}
              disabled
            >
              {isLocked ? <img src={lockIcon} alt="" aria-hidden="true" /> : null}
            </button>
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
        <div className={styles.rightContainer} aria-hidden="true" />
      </article>
    </div>
  );
}
