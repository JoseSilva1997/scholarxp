// Warns tutors before hard-deleting a student's module enrollment so destructive removals stay deliberate.
import { FiTrash2 } from 'react-icons/fi';
import styles from '@/Authoring/ModuleRoster/components/ConfirmRemoveStudentModal.module.css';

type ConfirmRemoveStudentModalProps = {
  isOpen: boolean;
  studentName: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// Renders the destructive confirmation dialog for removing a student from a module.
export default function ConfirmRemoveStudentModal({
  isOpen,
  studentName,
  isSubmitting = false,
  errorMessage = null,
  onConfirm,
  onCancel,
}: ConfirmRemoveStudentModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Remove student">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden>
            <FiTrash2 />
          </span>
          <div>
            <h2 className={styles.title}>Remove {studentName} from this module?</h2>
            <p className={styles.body}>
              This will permanently delete their module progress and they will lose
              access to the module. This action cannot be undone.
            </p>
          </div>
        </div>
        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Removing…' : 'Remove student'}
          </button>
        </div>
      </div>
    </div>
  );
}
