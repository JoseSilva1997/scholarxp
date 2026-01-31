// Card for launching creation of a new module unit; keeps the affordance consistent with other create entry points.
import type { MouseEventHandler } from 'react';
import styles from './CreateModuleUnitCard.module.css';

type CreateModuleUnitCardProps = {
  // Callback allows host pages to wire the CTA without locking this component to a specific flow yet.
  onClick?: MouseEventHandler<HTMLButtonElement>;
  isSaving?: boolean;
};

export default function CreateModuleUnitCard({ onClick, isSaving }: CreateModuleUnitCardProps) {
  return (
    <div className={styles.card} role="group" aria-label="Create a module unit">
      <button
        type="button"
        className={styles.createButton}
        onClick={onClick}
        disabled={isSaving}
        aria-label="Start creating a module unit"
        title="Create module unit"
      >
        +
      </button>
      <div className={styles.copy}>
        <p className={styles.title}>Create a lesson</p>
        <p className={styles.subtitle}>
          {isSaving ? 'Creating…' : 'Add practice sets to this module.'}
        </p>
      </div>
    </div>
  );
}
