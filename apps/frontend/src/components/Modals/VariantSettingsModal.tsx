// Modal for editing variant generation instructions; keeps the left panel header clean.
import { FiSettings, FiX } from 'react-icons/fi';
import styles from './VariantSettingsModal.module.css';

type VariantSettingsModalProps = {
  isOpen: boolean;
  variantInstructions: string;
  isSaving: boolean;
  onChangeInstructions: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function VariantSettingsModal({
  isOpen,
  variantInstructions,
  isSaving,
  onChangeInstructions,
  onSave,
  onClose,
}: VariantSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Variant Generation Settings">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden>
            <FiSettings />
          </span>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Variant Generation Settings</h2>
            <p className={styles.subtitle}>
              Define instructions to guide AI variant generation for this lesson.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close settings"
          >
            <FiX />
          </button>
        </div>
        <textarea
          className={styles.textarea}
          value={variantInstructions}
          onChange={(e) => onChangeInstructions(e.target.value)}
          placeholder="Concepts, constraints, difficulty level, or any context to help the AI generate relevant variants..."
          maxLength={500}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className={styles.primary} onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
