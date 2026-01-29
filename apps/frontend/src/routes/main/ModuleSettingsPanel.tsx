// Component that renders the collapsible module settings rail so the module page stays lean.
import { useEffect } from 'react';
import styles from './ModuleSettingsPanel.module.css';

type ModuleSettingsPanelProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
};

export default function ModuleSettingsPanel({ title, isOpen, onToggle }: ModuleSettingsPanelProps) {
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
          <h2 className={styles.settingsPanelTitle}>{title}</h2>
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
              <p className={styles.settingsSectionEyebrow}>Details</p>
              <h3 className={styles.settingsSectionTitle}>Edit module fields</h3>
            </div>
            <span className={styles.settingsBadge}>Coming soon</span>
          </header>
          <p className={styles.settingsSectionCopy}>
            We will let you adjust the module name, cadence, and defaults here. For now this panel
            previews the layout for settings edits.
          </p>
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
