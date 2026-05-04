// Centralizes opt-in debug metadata so routes can expose local state without duplicating flag checks or styling.
import type { ReactNode } from 'react';
import { isUiDebugEnabled } from '@/utils/uiDebug';
import styles from '@/MainApp/DebugMeta.module.css';

type DebugMetaEntry = {
  label: string;
  value: ReactNode;
};

type DebugMetaProps = {
  entries: DebugMetaEntry[];
  className?: string;
};

export default function DebugMeta({ entries, className }: DebugMetaProps) {
  if (!isUiDebugEnabled || entries.length === 0) {
    return null;
  }

  return (
    <div
      className={className ? `${styles.debugMeta} ${className}` : styles.debugMeta}
      data-testid="debug-meta"
    >
      <span className={styles.prefix}>Debug:</span>
      {entries.map((entry) => (
        <span key={entry.label} className={styles.entry}>
          <span className={styles.label}>{entry.label}</span> {entry.value}
        </span>
      ))}
    </div>
  );
}
