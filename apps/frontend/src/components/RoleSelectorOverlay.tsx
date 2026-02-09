// RoleSelectorOverlay blocks the app until a newly verified user chooses a role, ensuring
// we collect their context before loading the main experience or rendering header identity.
import { useState } from 'react';
import type { AuthUser, GlobalRole } from '../types/auth';
import styles from './RoleSelectorOverlay.module.css';
import { logError } from '../utils/logger';
import { useUpdateUserRoleMutation } from '../hooks/queries/useUserMutations';

type RoleSelectorOverlayProps = {
  user: AuthUser;
  onRoleSelected: (user: AuthUser) => void;
};

export default function RoleSelectorOverlay({ user, onRoleSelected }: RoleSelectorOverlayProps) {
  const updateUserRoleMutation = useUpdateUserRoleMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(role: Exclude<GlobalRole, 'pending'>) {
    // Keep selection idempotent while an update is in flight to avoid double PATCH.
    if (updateUserRoleMutation.isPending) return;
    setError(null);
    try {
      const updatedUser = await updateUserRoleMutation.mutateAsync({
        userId: user.id,
        globalRole: role,
      });
      onRoleSelected(updatedUser);
    } catch (err) {
      logError(err, { feature: 'role-selector', action: 'update-role' });
      setError('We could not save your role right now. Please try again.');
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="role-title">
      <div className={styles.card}>
        <p className={styles.pill}>Welcome, {user.firstName}</p>
        <h2 id="role-title" className={styles.title}>
          Choose your role to continue
        </h2>
        <p className={styles.subtitle}>
          Pick 
          the role that best matches how you will use ScholarXP.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.buttonPrimary}
            disabled={updateUserRoleMutation.isPending}
            onClick={() => handleSelect('student')}
          >
            {updateUserRoleMutation.isPending ? 'Saving…' : 'I’m a student'}
          </button>
          <button
            type="button"
            className={styles.buttonPrimary}
            disabled={updateUserRoleMutation.isPending}
            // Use the backend enum value; UI copy can stay human-friendly.
            onClick={() => handleSelect('teacher')}
          >
            {updateUserRoleMutation.isPending ? 'Saving…' : 'I’m a teacher'}
          </button>
        </div>
        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
