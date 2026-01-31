// Component that renders the collapsible module settings rail so the module page stays lean.
import { useEffect, useMemo, useState } from 'react';
import styles from './ModuleSettingsPanel.module.css';
import type { ModuleInvite, ModuleSummary } from '../types/module';
import { updateModule } from '../api/modules';
import CopyIcon from './svg-icons/CopyIcon';
import {
  createModuleInvite,
  deleteModuleInvite,
  listModuleInvites,
  updateModuleInvite,
} from '../api/moduleInvites';
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
  const [invites, setInvites] = useState<ModuleInvite[]>([]);
  const [inviteLinks, setInviteLinks] = useState<Record<number, string>>({});
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInvitesLoading, setIsInvitesLoading] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [createExpiry, setCreateExpiry] = useState(48);
  const [createMaxUses, setCreateMaxUses] = useState(100);

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
    setInviteError(null);
  }, [module, isOpen]);

  const isReady = useMemo(() => Boolean(module), [module]);
  const isInviteEnabled = useMemo(
    () => Boolean(module && module.institutionId === null),
    [module],
  );

  useEffect(() => {
    // Load invites when the panel opens for eligible modules so the list stays fresh without extra clicks.
    if (!isOpen || !module || !isInviteEnabled) return;
    void loadInvites(module.id);
  }, [isOpen, module, isInviteEnabled]);

  async function loadInvites(moduleId: number) {
    setIsInvitesLoading(true);
    setInviteError(null);
    try {
      const records = await listModuleInvites(moduleId);
      setInvites(records);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not load invites right now. Please try again.';
      setInviteError(message);
      logError(err, { feature: 'module-invites', action: 'list', moduleId });
    } finally {
      setIsInvitesLoading(false);
    }
  }

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

  async function handleCreateInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!module || isCreatingInvite) return;
    setIsCreatingInvite(true);
    setInviteError(null);
    try {
      const result = await createModuleInvite(module.id, {
        expiresInHours: createExpiry,
        maxUses: createMaxUses,
      });
      // Store the link in-memory so instructors can copy it immediately; backend only returns token on creation.
      setInviteLinks((prev) => ({ ...prev, [result.invite.id]: result.url }));
      setInvites((prev) => [result.invite, ...prev]);
      setCreateExpiry(48);
      setCreateMaxUses(100);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not create invite. Please try again.';
      setInviteError(message);
      logError(err, { feature: 'module-invites', action: 'create', moduleId: module.id });
    } finally {
      setIsCreatingInvite(false);
    }
  }

  async function handleRevoke(invite: ModuleInvite) {
    if (!module) return;
    setInviteError(null);
    try {
      const updated = await updateModuleInvite(module.id, invite.id, { revoke: true });
      setInvites((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not revoke invite. Please try again.';
      setInviteError(message);
      logError(err, { feature: 'module-invites', action: 'revoke', moduleId: module.id });
    }
  }

  async function handleDelete(invite: ModuleInvite) {
    if (!module) return;
    setInviteError(null);
    try {
      await deleteModuleInvite(module.id, invite.id);
      setInvites((prev) => prev.filter((item) => item.id !== invite.id));
      setInviteLinks((prev) => {
        const copy = { ...prev };
        delete copy[invite.id];
        return copy;
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Could not delete invite. Please try again.';
      setInviteError(message);
      logError(err, { feature: 'module-invites', action: 'delete', moduleId: module.id });
    }
  }

  function formatExpiry(invite: ModuleInvite) {
    if (invite.revokedAt) return 'Revoked';
    if (!invite.expiresAt) return 'No expiry';
    const date = new Date(invite.expiresAt);
    return `Expires ${date.toLocaleDateString()}`;
  }

  function renderInviteActions(invite: ModuleInvite) {
    const link = inviteLinks[invite.id];
    const canCopy = Boolean(link);
    return (
      <div className={styles.inviteActions}>
        {canCopy ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              navigator.clipboard
                .writeText(link ?? '')
                .catch((err) =>
                  logError(err, { feature: 'module-invites', action: 'copy', inviteId: invite.id }),
                );
            }}
            aria-label="Copy invite link"
          >
            <CopyIcon/>
          </button>
        ) : (
          <span className={styles.inviteHint}>Create a new link to copy</span>
        )}
        {!invite.revokedAt ? (
          <button
            type="button"
            className={styles.dangerGhostButton}
            onClick={() => void handleRevoke(invite)}
          >
            Revoke
          </button>
        ) : (
          <button
            type="button"
            className={styles.dangerGhostButton}
            onClick={() => void handleDelete(invite)}
          >
            Delete
          </button>
        )}
      </div>
    );
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
        {/* 
        Invites & membership section 
        */}
        <section className={styles.settingsSection}>
          <header className={styles.settingsSectionHeader}>
            <div>
              <h3 className={styles.settingsSectionTitle}>Invites & membership</h3>
            </div>
          </header>
          {isInviteEnabled ? (
            <>
              {inviteError ? (
                <div className={styles.inlineError} role="alert">
                  {inviteError}
                </div>
              ) : null}
              <form className={styles.inviteForm} onSubmit={handleCreateInvite}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Expiry (hours)</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={createExpiry}
                    onChange={(e) => setCreateExpiry(Number(e.target.value))}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Max uses</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={createMaxUses}
                    onChange={(e) => setCreateMaxUses(Number(e.target.value))}
                  />
                </label>
                <div className={styles.actions}>
                  <button
                    className={styles.primaryButton}
                    type="submit"
                    disabled={isCreatingInvite || !module}
                  >
                    {isCreatingInvite ? 'Creating…' : 'Create invite'}
                  </button>
                </div>
              </form>

              <div className={styles.inviteListHeader}>
                <h4 className={styles.inviteListTitle}>Active invites</h4>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isInvitesLoading}
                  onClick={() => module && void loadInvites(module.id)}
                >
                  {isInvitesLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              {isInvitesLoading ? (
                <div className={styles.settingsPlaceholderGroup}>
                  <div className={styles.settingsPlaceholderRow}>
                    <div className={styles.settingsPlaceholderLabel} />
                    <div className={styles.settingsPlaceholderInputWide} />
                  </div>
                </div>
              ) : invites.length === 0 ? (
                <p className={styles.settingsSectionCopy}>
                  No invites yet. Create a link to start inviting students.
                </p>
              ) : (
                <ul className={styles.inviteList} aria-live="polite">
                  {invites.map((invite) => (
                    <li key={invite.id} className={styles.inviteItem}>
                      <div className={styles.inviteMeta}>
                        <p className={styles.inviteTitle}>
                          Created {new Date(invite.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                          {invite.revokedAt ? ' (revoked)' : ''}
                        </p>
                        <p className={styles.inviteSubtext}>
                          {formatExpiry(invite)} • Uses {invite.uses}
                          {invite.maxUses ? ` / ${invite.maxUses}` : ' (no cap)'}
                        </p>
                      </div>
                      {renderInviteActions(invite)}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className={styles.settingsSectionCopy}>
              Invites are available only for modules created outside an institution. This module is
              institution-managed, so roster changes must happen through the LMS.
            </p>
          )}
        </section>
      </div>
    </aside>
    </>
  );
}
