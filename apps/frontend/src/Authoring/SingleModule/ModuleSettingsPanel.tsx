// Component that renders the collapsible module settings rail so the module page stays lean.
import { useEffect, useMemo } from 'react';
import styles from '@/Authoring/SingleModule/ModuleSettingsPanel.module.css';
import type { ModuleInvite, ModuleSummary } from '@/shared/types/module';
import { FaRegCopy, FaXmark } from "react-icons/fa6";
import { IconContext } from 'react-icons';
import { useModuleInvitesPanelState } from '@/Authoring/SingleModule/useModuleInvitesPanelState';
import { useModuleSettingsForm } from '@/Authoring/SingleModule/useModuleSettingsForm';

type ModuleSettingsPanelProps = {
  module: ModuleSummary | null;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: (updated: ModuleSummary) => void;
  canManageInvites: boolean;
};

export default function ModuleSettingsPanel({
  module,
  isOpen,
  onToggle,
  onSaved,
  canManageInvites,
}: ModuleSettingsPanelProps) {
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

  const isReady = useMemo(() => Boolean(module), [module]);
  const isInviteEnabled = useMemo(
    () => Boolean(module && module.institutionId === null),
    [module],
  );
  const canShowInvites = useMemo(
    () => Boolean(canManageInvites && isInviteEnabled),
    [canManageInvites, isInviteEnabled],
  );
  const {
    invites,
    inviteError,
    isInvitesLoading,
    isCreatingInvite,
    createExpiry,
    setCreateExpiry,
    createMaxUses,
    setCreateMaxUses,
    refreshInvites,
    handleCreateInvite,
    handleRevokeInvite,
    handleDeleteInvite,
    formatExpiry,
    canCopyInviteLink,
    isInviteCopied,
    copyInviteLink,
  } = useModuleInvitesPanelState({
    module,
    isOpen,
    canShowInvites,
  });
  const {
    title,
    setTitle,
    description,
    setDescription,
    variantContext,
    setVariantContext,
    isSaving,
    error,
    status,
    handleSubmit,
    handleReset,
  } = useModuleSettingsForm({ module, isOpen, onSaved });

  function renderInviteActions(invite: ModuleInvite) {
    const canCopy = canCopyInviteLink(invite);
    const isCopied = isInviteCopied(invite);
    const expiryStatus = formatExpiry(invite);
    const isExpired =
      expiryStatus.startsWith('Expired') || invite.revokedAt;

    return (
      <div className={styles.inviteActions}>
        {canCopy && !isExpired ? (
          <button
            type="button"
            className={`${styles.copyButton} ${isCopied ? styles.copyButtonSuccess : ''}`}
            onClick={() => copyInviteLink(invite)}
            aria-label="Copy invite link"
            title={isCopied ? 'Copied!' : 'Copy invite link'}
          >
            <IconContext.Provider value={{ className: styles.copyIcon }}>
              <FaRegCopy />
            </IconContext.Provider>
            <span className={styles.copyButtonLabel}>{isCopied ? 'Copied!' : 'Copy'}</span>
          </button>
        ) : (
          <span className={styles.inviteHint}>Link expired</span>
        )}
        {isExpired ? (
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => void handleDeleteInvite(invite)}
          >
            Delete
          </button>
        ) : (
          <button
            type="button"
            className={styles.revokeButton}
            onClick={() => void handleRevokeInvite(invite)}
          >
            Revoke
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
          aria-label="Close settings panel"
          onClick={onToggle}
        >
          <FaXmark />
        </button>
      </header>

      <div className={styles.settingsPanelBody}>
        <section className={styles.settingsSection}>
          <header className={styles.settingsSectionHeader}>
            <h3 className={styles.settingsSectionTitle}>General Settings</h3>
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
                  onClick={handleReset}
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
            <h3 className={styles.settingsSectionTitle}>Invites & Membership</h3>
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
                  <span className={styles.fieldLabel}>Expiry (h)</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={createExpiry}
                    onChange={(e) => setCreateExpiry(Number(e.target.value))}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Uses</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={createMaxUses}
                    onChange={(e) => setCreateMaxUses(Number(e.target.value))}
                  />
                </label>
                <button
                  className={styles.createInviteButton}
                  type="submit"
                  disabled={isCreatingInvite || !module}
                >
                  {isCreatingInvite ? '...' : 'Create'}
                </button>
              </form>

              <div className={styles.inviteListHeader}>
                <h4 className={styles.inviteListTitle}>Active invites</h4>
                <button
                  type="button"
                  className={styles.refreshButton}
                  disabled={isInvitesLoading}
                  onClick={refreshInvites}
                >
                  {isInvitesLoading ? '...' : 'Refresh'}
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
                  {invites.map((invite) => {
                    // Determine if invite is in an inactive state
                    const isInactive = formatExpiry(invite).startsWith('Expired') || invite.revokedAt;
                    return (
                      <li key={invite.id} className={`${styles.inviteItem} ${isInactive ? styles.inviteItemInactive : ''}`}>
                        <div className={styles.inviteCardHeader}>
                          <div className={styles.inviteMeta}>
                            <div className={styles.inviteMetaTop}>
                              <p className={styles.inviteTitle}>
                                {new Date(invite.createdAt).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric'
                                })} at {new Date(invite.createdAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              <span
                                className={`${styles.inviteStatus} ${
                                  isInactive
                                    ? styles.inviteStatusInactive
                                    : styles.inviteStatusActive
                                }`}
                              >
                                {isInactive ? 'Inactive' : 'Active'}
                              </span>
                            </div>
                            <p className={`${styles.inviteSubtext}`}>
                              {formatExpiry(invite)}
                            </p>
                            <div className={styles.inviteUsage}>
                              <span className={styles.usageLabel}>Usage:</span>
                              <span className={styles.usageValue}>{invite.uses} {invite.maxUses ? `/ ${invite.maxUses}` : '(unlimited)'}</span>
                            </div>
                          </div>
                        </div>
                        {renderInviteActions(invite)}
                      </li>
                    );
                  })}
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
