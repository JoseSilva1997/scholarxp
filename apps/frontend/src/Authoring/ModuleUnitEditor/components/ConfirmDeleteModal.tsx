// ConfirmDeleteModal prompts authors before deleting editor items so destructive actions stay intentional.
import { FiTrash2 } from 'react-icons/fi';
import styles from '@/Authoring/ModuleUnitEditor/components/ConfirmDeleteModal.module.css';

type ConfirmDeleteModalProps = {
  isOpen: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// Renders a reusable destructive-action confirmation modal for editor deletions.
export default function ConfirmDeleteModal({
  isOpen,
  title,
  body,
  confirmLabel = 'Delete',
  isSubmitting = false,
  errorMessage = null,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  // Avoid keeping modal markup in the DOM when closed so focus management stays predictable.
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden>
            <FiTrash2 />
          </span>
          <div>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.body}>{body}</p>
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
            {isSubmitting ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
