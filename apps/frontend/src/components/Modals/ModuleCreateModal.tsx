// Modal to create a module; honors backend scoping via session cookie and surfaces friendly errors.
import { useState } from 'react';
import styles from './ModuleCreateModal.module.css';
import {
  getDisplayErrorMessage,
  shouldLogApiError,
} from '../../api/get-display-error';
import type { ModuleSummary } from '../../types/module';
import { useAuth } from '../../context/AuthContext';
import { logError } from '../../utils/logger';
import { createModule } from '../../api/modules';
import { canUserAccess } from '../../permissions/permission';

type ModuleCreateModalProps = {
  onClose: () => void;
  onCreated: (module: ModuleSummary) => void;
};

export default function ModuleCreateModal({ onClose, onCreated }: ModuleCreateModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Teachers can create modules but only admins/institution admins can bind to an institution.
  const canSetInstitution = canUserAccess('modules.setInstitution', user);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload: {
        title: string;
        description?: string;
        institutionId?: number;
      } = {
        title: title.trim(),
        description: description.trim() || undefined,
      };
      if (canSetInstitution && institutionId.trim()) {
        payload.institutionId = Number(institutionId.trim());
      }
      const created = await createModule(payload);
      onCreated(created);
      onClose();
    } catch (err) {
      const message = getDisplayErrorMessage(err, {
        fallbackMessage: 'Could not create module. Please try again.',
      });
      setError(message);
      if (shouldLogApiError(err)) {
        logError(err, { feature: 'modules', action: 'create' });
      }
    } finally {
      setIsSaving(false);
    }
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
