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
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.badgeWrapper} aria-hidden="true">
          <div className={styles.badgeHole}>{isLocked ? <img src={lockIcon} alt="" /> : null}</div>
        </div>
        <div className={styles.meta}>
          <h3 className={styles.title}>{unit.title}</h3>
          <p className={styles.subtitle}>{unit.questionGroups.length}/? Questions</p>
        </div>
        <button type="button" className={styles.practiceButton} aria-label="Start practice">
          Start Practice
        </button>
      </div>
    </article>
  );
}
