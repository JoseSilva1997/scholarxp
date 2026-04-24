// Modal prompting teachers to change lesson visibility; copy is supplied by caller.
import { createPortal } from 'react-dom';
import styles from '@/Authoring/SingleModule/components/ConfirmPublishModal.module.css';

type ConfirmPublishModalProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  errorMessage?: string;
  title: string;
  body: string;
  confirmLabel: string;
};

export default function ConfirmPublishModal({
  isOpen,
  onCancel,
  onConfirm,
  isSubmitting = false,
  errorMessage,
  title,
  body,
  confirmLabel,
}: ConfirmPublishModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Publish lesson">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.body}>{body}</p>
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
            className={styles.primary}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
