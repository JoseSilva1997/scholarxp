// Component that renders the collapsible module settings rail so the module page stays lean.
import { useEffect, useMemo, useState } from 'react';
import styles from './ModuleSettingsPanel.module.css';
import type { ModuleSummary } from '../types/module';
import { updateModule } from '../api/modules';
import { ApiError } from '../api/client';
import { logError } from '../utils/logger';

type ModuleSettingsPanelProps = {
  module: ModuleSummary | null;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: (updated: ModuleSummary) => void;
};

export default function ModuleSettingsPanel({
  module,
  isOpen,
  onToggle,
  onSaved,
}: ModuleSettingsPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [variantContext, setVariantContext] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Prevent body scroll when settings panel is open to avoid layout shift from scrollbar.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keep form fields in sync with the loaded module whenever the panel opens or data refreshes.
  useEffect(() => {
    if (!module) return;
    setTitle(module.title ?? '');
    setDescription(module.description ?? '');
    setVariantContext(module.variantContext ?? '');
    setError(null);
    setStatus(null);
  }, [module, isOpen]);

  const isReady = useMemo(() => Boolean(module), [module]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!module || isSaving) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }

    const payload: {
      title: string;
      description?: string | null;
      variantContext?: string | null;
    } = { title: trimmedTitle };

    payload.description = description.trim() ? description.trim() : null;
    payload.variantContext = variantContext.trim() ? variantContext.trim() : null;

    setIsSaving(true);
    setError(null);
    setStatus(null);
    try {
      const updated = await updateModule(module.id, payload);
      onSaved(updated);
      setStatus('Saved');
    } catch (err) {
      let message = 'Could not save module settings. Please try again.';
      if (err instanceof ApiError) {
        if (err.status === 401) {
          message = 'Your session expired. Please sign in again.';
        } else if (err.status === 403) {
          message = "You don't have permission to edit this module.";
        } else if (err.status === 400) {
          message = err.message;
        }
      }
      setError(message);
      logError(err, { feature: 'modules', action: 'update', moduleId: module.id });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
      <aside
        className={`${styles.settingsPanel} ${
          isOpen ? styles.settingsPanelOpen : styles.settingsPanelClosed
        }`}
        role="complementary"
        aria-label="Module settings"
        aria-hidden={!isOpen}
      >
      <header className={styles.settingsPanelHeader}>
        <div>
          <p className={styles.settingsPanelEyebrow}>Module settings</p>
          <h2 className={styles.settingsPanelTitle}>{module?.title ?? 'Module'}</h2>
        </div>
        <button
          className={styles.closeSettingsButton}
          type="button"
          aria-label={isOpen ? 'Collapse settings panel' : 'Expand settings panel'}
          onClick={onToggle}
        >
          {isOpen ? '←' : '→'}
        </button>
      </header>

      <div className={styles.settingsPanelBody}>
        <section className={styles.settingsSection}>
          <header className={styles.settingsSectionHeader}>
            <div>
              <h3 className={styles.settingsSectionTitle}>Edit</h3>
            </div>
          </header>

          {!isReady ? (
            <div className={styles.settingsPlaceholderGroup}>
              <div className={styles.settingsPlaceholderRow}>
                <div className={styles.settingsPlaceholderLabel} />
                <div className={styles.settingsPlaceholderInput} />
              </div>
              <div className={styles.settingsPlaceholderRow}>
                <div className={styles.settingsPlaceholderLabel} />
                <div className={styles.settingsPlaceholderInputWide} />
              </div>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              {error ? (
                <div className={styles.inlineError} role="alert">
                  {error}
                </div>
              ) : null}
              {status ? <div className={styles.success}>{status}</div> : null}

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Title</span>
                <input
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={120}
                />
              </label>

              <label className={styles.field}>
                <div>
                  <span className={styles.fieldLabel}>Description</span>
                  <span className={styles.hint}>(Optional)</span>
                </div>
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </label>

              <label className={styles.field}>
                <div>
                  <span className={styles.fieldLabel}>Variant context</span>
                  <span className={styles.hint}>(Optional)</span>
                </div>
                
                <textarea
                  className={styles.textarea}
                  value={variantContext}
                  onChange={(e) => setVariantContext(e.target.value)}
                  maxLength={255}
                  placeholder="Give instructions to the AI question generator about how to tailor questions for this module."
                />
              </label>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    if (!module) return;
                    setTitle(module.title ?? '');
                    setDescription(module.description ?? '');
                    setVariantContext(module.variantContext ?? '');
                    setError(null);
                    setStatus(null);
                  }}
                  disabled={isSaving}
                >
                  Reset
                </button>
                <button className={styles.primaryButton} type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className={styles.settingsSection}>
          <header className={styles.settingsSectionHeader}>
            <div>
              <p className={styles.settingsSectionEyebrow}>Roster</p>
              <h3 className={styles.settingsSectionTitle}>Invites & membership</h3>
            </div>
            <span className={styles.settingsBadge}>Coming soon</span>
          </header>
          <p className={styles.settingsSectionCopy}>
            Generate invite links and manage the roster here. We will wire this to roster APIs next so
            you can add and remove learners directly.
          </p>
          <div className={styles.settingsPlaceholderGroup}>
            <div className={styles.settingsPlaceholderRow}>
              <div className={styles.settingsPlaceholderInputWide} />
              <div className={styles.settingsPlaceholderButton} />
            </div>
            <div className={styles.settingsRosterList}>
              <div className={styles.settingsRosterItem}>
                <div className={styles.settingsRosterAvatar} />
                <div className={styles.settingsRosterMeta}>
                  <div className={styles.settingsPlaceholderLabel} />
                  <div className={styles.settingsPlaceholderMicro} />
                </div>
                <div className={styles.settingsPlaceholderButtonSmall} />
              </div>
              <div className={styles.settingsRosterItem}>
                <div className={styles.settingsRosterAvatar} />
                <div className={styles.settingsRosterMeta}>
                  <div className={styles.settingsPlaceholderLabel} />
                  <div className={styles.settingsPlaceholderMicro} />
                </div>
                <div className={styles.settingsPlaceholderButtonSmall} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
    </>
  );
}
