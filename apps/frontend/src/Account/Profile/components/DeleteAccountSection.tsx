// Self-serve account deletion entry point. Lives at the bottom of the profile page behind a divider so it
// reads as a clearly separate "danger zone" rather than a routine profile control.
import { useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '@/shared/types/auth';
import { useAuth } from '@/context/AuthContext';
import { deleteOwnAccount } from '@/Account/api/users';
import { logError } from '@/utils/logger';
import DeleteAccountModal from '@/Account/Profile/components/DeleteAccountModal';
import styles from '@/Account/Profile/components/DeleteAccountSection.module.css';

type DeleteAccountSectionProps = {
  user: AuthUser;
};

// Permissive RFC-style email check: backend re-validates with class-validator's IsEmail, so this only needs
// to gate the local Delete button before users hit the modal.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Validation =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'mismatch'; message: string }
  | { kind: 'ok' };

function validate(input: string, accountEmail: string | null): Validation {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'empty' };
  if (!EMAIL_REGEX.test(trimmed)) {
    return { kind: 'invalid', message: 'Enter a valid email.' };
  }
  if (!accountEmail || trimmed.toLowerCase() !== accountEmail.toLowerCase()) {
    return { kind: 'mismatch', message: 'Email does not match your account.' };
  }
  return { kind: 'ok' };
}

export default function DeleteAccountSection({ user }: DeleteAccountSectionProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [email, setEmail] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validation = useMemo(() => validate(email, user.email), [email, user.email]);
  const validationMessage =
    validation.kind === 'invalid' || validation.kind === 'mismatch'
      ? validation.message
      : '';
  const canSubmit = validation.kind === 'ok' && !isDeleting;

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleOpenModal = () => {
    if (!canSubmit) return;
    setServerError(null);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    if (isDeleting) return;
    setIsModalOpen(false);
    setServerError(null);
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setIsDeleting(true);
    setServerError(null);
    try {
      await deleteOwnAccount(email.trim());
      // Backend already destroyed the session; client-side logout clears cached user/queries and refreshes CSRF.
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      logError(err, { source: 'DeleteAccountSection.delete' });
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not delete account. Try again.';
      setServerError(message);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className={styles.divider} role="separator" aria-hidden />
      <section className={styles.section} aria-labelledby="delete-account-heading">
        <h2 id="delete-account-heading" className={styles.heading}>
          Danger zone
        </h2>
        <p className={styles.description}>
          Permanently delete your account. This cannot be undone. Type your email to enable deletion.
        </p>
        <div className={styles.row}>
          <input
            type="email"
            className={styles.input}
            placeholder="your@email.com"
            value={email}
            onChange={handleEmailChange}
            autoComplete="off"
            aria-label="Confirm your email to enable account deletion"
            aria-invalid={validation.kind === 'invalid' || validation.kind === 'mismatch'}
            disabled={isDeleting}
          />
          <button
            type="button"
            className={styles.button}
            onClick={handleOpenModal}
            disabled={!canSubmit}
          >
            Delete account
          </button>
        </div>
        <p className={styles.validation} aria-live="polite">
          {validationMessage}
        </p>
      </section>
      <DeleteAccountModal
        isOpen={isModalOpen}
        role={user.globalRole}
        isSubmitting={isDeleting}
        errorMessage={serverError}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
