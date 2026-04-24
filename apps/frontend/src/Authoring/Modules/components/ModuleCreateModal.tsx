// Modal form for module creation; delegates network side effects to the parent route mutation flow.
import { useState } from 'react';
import type { CreateModulePayload } from '@scholarxp/api-contracts';
import styles from '@/Authoring/Modules/components/ModuleCreateModal.module.css';
import { useAuth } from '@/context/AuthContext';
import { canUserAccess } from '@/shared/permissions/permission';
import { features } from '@scholarxp/permissions';

type ModuleCreateModalProps = {
  onClose: () => void;
  onCreate: (payload: CreateModulePayload) => Promise<void>;
  isSaving: boolean;
  error: string | null;
};

export default function ModuleCreateModal({
  onClose,
  onCreate,
  isSaving,
  error,
}: ModuleCreateModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [institutionId, setInstitutionId] = useState('');

  // Teachers can create modules but only admins/institution admins can bind to an institution.
  const canSetInstitution = canUserAccess(features.modules.setInstitution, user);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving) return;

    const payload: CreateModulePayload = {
      title: title.trim(),
      description: description.trim() || undefined,
    };
    if (canSetInstitution && institutionId.trim()) {
      payload.institutionId = Number(institutionId.trim());
    }

    await onCreate(payload);
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Create module">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create module</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {error ? (
          <div className={styles.error} role="alert">
            {error}
          </div>
        ) : null}
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Title
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label className={styles.label}>
            Description (optional)
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </label>
          {canSetInstitution ? (
            <label className={styles.label}>
              Institution ID (required for institution admins)
              <input
                className={styles.input}
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                required={user?.globalRole === 'institution_admin'}
              />
            </label>
          ) : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.primary}
              disabled={isSaving || title.trim().length === 0}
            >
              {isSaving ? 'Creating…' : 'Create module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

