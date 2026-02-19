// Card for launching creation of a new module unit; keeps the affordance consistent with other create entry points.
import type { MouseEventHandler } from 'react';
import { FaCirclePlus } from 'react-icons/fa6';
import { IconContext } from 'react-icons';
import styles from './CreateModuleUnitCard.module.css';

type CreateModuleUnitCardProps = {
  // Callback allows host pages to wire the CTA without locking this component to a specific flow yet.
  onClick?: MouseEventHandler<HTMLButtonElement>;
  isSaving?: boolean;
};

export default function CreateModuleUnitCard({ onClick, isSaving }: CreateModuleUnitCardProps) {
  return (
    <div className={styles.wrapper}>
      <article className={styles.card} role="group" aria-label="Create a module unit">
        <div className={styles.leftContainer} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.header}>
            <button
              type="button"
              className={styles.createButton}
              onClick={onClick}
              disabled={isSaving}
              aria-label="Start creating a module unit"
              title="Create module unit"
            >
              <IconContext.Provider value={{ className: styles.createIcon }}>
                <FaCirclePlus aria-hidden="true" />
              </IconContext.Provider>
            </button>
            <div className={styles.copy}>
              <h3 className={styles.title}>Create a lesson</h3>
              <p className={styles.subtitle}>
                {isSaving ? 'Creating…' : 'Add practice sets to this module.'}
              </p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
