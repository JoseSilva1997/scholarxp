// Modal prompting teachers to publish a module unit; keeps copy explicit about student visibility.
import styles from './ConfirmPublishModal.module.css';

type ConfirmPublishModalProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  errorMessage?: string;
};

export default function ConfirmPublishModal({
  isOpen,
  onCancel,
  onConfirm,
  isSubmitting = false,
  errorMessage,
}: ConfirmPublishModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Publish lesson">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Ready to publish lesson?</h2>
        <p className={styles.body}>
          You can still edit it. Students will see its title but the contents will be locked until you set it live.
        </p>
        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
