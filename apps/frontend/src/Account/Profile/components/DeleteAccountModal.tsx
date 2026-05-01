// Final confirmation step before self-serve account deletion. Hard delete is irreversible, so we surface
// an explicit warning between the email input and the actual destructive call.
import { FiTrash2 } from 'react-icons/fi';
import type { GlobalRole } from '@scholarxp/api-contracts';
import styles from '@/Account/Profile/components/DeleteAccountModal.module.css';

type DeleteAccountModalProps = {
  isOpen: boolean;
  role: GlobalRole;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// Body copy is role-specific because students lose gamified data (XP, streaks, daily quests) while
// teachers' authored content (modules, lessons, questions) is reassigned to an Anon author rather than deleted.
function bodyText(role: GlobalRole): string {
  if (role === 'teacher') {
    return 'This action is permanent and cannot be undone. Modules, lessons, and questions you authored will remain accessible to students but will no longer be attributed to you.';
  }
  if (role === 'student') {
    return 'This action is permanent and cannot be undone. All your progress, XP, daily quests, and module enrollments will be erased.';
  }
  return 'This action is permanent and cannot be undone.';
}

export default function DeleteAccountModal({
  isOpen,
  role,
  isSubmitting = false,
  errorMessage = null,
  onConfirm,
  onCancel,
}: DeleteAccountModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Delete account">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden>
            <FiTrash2 />
          </span>
          <div>
            <h2 className={styles.title}>Delete account?</h2>
            <p className={styles.body}>{bodyText(role)}</p>
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
            {isSubmitting ? 'Deleting…' : 'Yes, delete my account'}
          </button>
        </div>
      </div>
    </div>
  );
}
