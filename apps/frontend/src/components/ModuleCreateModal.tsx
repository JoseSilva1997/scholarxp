// Modal to create a module; honors backend scoping via session cookie and surfaces friendly errors.
import { useState } from 'react';
import styles from './ModuleCreateModal.module.css';
import { ApiError } from '../api/client';
import type { ModuleSummary } from '../types/module';
import { useAuth } from '../context/AuthContext';
import { logError } from '../utils/logger';
import { createModule } from '../api/modules';

type ModuleCreateModalProps = {
  onClose: () => void;
  onCreated: (module: ModuleSummary) => void;
};

export default function ModuleCreateModal({ onClose, onCreated }: ModuleCreateModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [variantContext, setVariantContext] = useState('');
  const [description, setDescription] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSetInstitution =
    user?.globalRole === 'institution_admin' || user?.globalRole === 'admin';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload: {
        title: string;
        variantContext: string;
        description?: string;
        institutionId?: number;
      } = {
        title: title.trim(),
        variantContext: variantContext.trim(),
        description: description.trim() || undefined,
      };
      if (canSetInstitution && institutionId.trim()) {
        payload.institutionId = Number(institutionId.trim());
      }
      const created = await createModule(payload);
      onCreated(created);
      onClose();
    } catch (err) {
      let message = 'Could not create module. Please try again.';
      if (err instanceof ApiError) {
        if (err.status === 401) {
          message = 'Your session expired. Please sign in again.';
        } else if (err.status === 403) {
          message = "You don't have permission to create modules.";
        } else if (err.status === 400) {
          message = err.message;
        }
      }
      setError(message);
      logError(err, { feature: 'modules', action: 'create' });
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
            Variant context
            <input
              className={styles.input}
              value={variantContext}
              onChange={(e) => setVariantContext(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              placeholder="e.g., math101-fall"
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
            <button type="submit" className={styles.primary} disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
