// Modal to capture a new module unit title; intentionally simple until backend wiring exists.
import { useEffect, useRef, useState } from 'react';
import styles from '@/Authoring/SingleModule/components/CreateModuleUnitModal.module.css';

type CreateModuleUnitModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
};

// Presents a modal for creating a lesson shell and resets local form state after close/submit.
export default function CreateModuleUnitModal({ isOpen, onClose, onCreate }: CreateModuleUnitModalProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isTitleValid = title.trim().length > 0;

  useEffect(() => {
    if (isOpen) {
      // Autofocus reduces clicks when creators are adding many units.
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    // Closes the modal via Escape so keyboard users can abandon the create flow quickly.
    const handleKey = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Clears transient input and validation state before delegating close to the parent.
  const handleClose = () => {
    setTitle('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  // Validates the title locally and emits a trimmed value for creation.
  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Please add a title for this unit.');
      return;
    }
    onCreate(trimmed);
    setTitle('');
    setError(null);
    onClose();
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Create module unit"
      onClick={handleClose}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Create a new lesson</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label} htmlFor="unit-title">
            Title
          </label>
          <input
            id="unit-title"
            className={styles.input}
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter titles of the lesson, e.g., 'Introduction to Algebra'"
            ref={inputRef}
          />
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={!isTitleValid} aria-disabled={!isTitleValid}>
              Add lesson
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
