// Renders a True/False answer form; uses first two options from parent-controlled state.
import { useState, useRef, useEffect } from 'react';
import styles from '@/Authoring/ModuleUnitEditor/components/question-types/forms/QuestionTypeForms.module.css';
import { FiInfo } from 'react-icons/fi';

type TfOption = {
  id: string;
  value: string;
  isCorrect: boolean;
  explanation: string;
};

type TrueFalseFormProps = {
  options: TfOption[];
  onChangeOption: (id: string, value: string) => void;
  onChangeExplanation: (id: string, value: string) => void;
  onSelectCorrect: (id: string) => void;
};

// Renders the binary True/False controls while preserving the parent editor's generic option shape.
export function TrueFalseForm({
  options,
  onChangeExplanation,
  onSelectCorrect,
}: TrueFalseFormProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    // Closes the helper popover when the user clicks outside the info control.
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen]);

  // Defensive slice keeps the binary form stable if a cached MCQ-shaped form is switched to True/False.
  const limitedOptions = options.slice(0, 2);
  return (
    <div className={styles.optionsSection}>
      <div className={styles.sectionHeadingRow} ref={popoverRef}>
        <h3>Answer Options (True / False)</h3>
        <button
          type="button"
          className={styles.infoBtn}
          aria-label="Answer options info"
          onClick={() => setPopoverOpen((prev) => !prev)}
        >
          <FiInfo aria-hidden="true" />
        </button>
        {popoverOpen && (
          <div className={styles.infoPopover} role="tooltip">
            Explanations are optional - shown to students after they answer.
          </div>
        )}
      </div>
      <div className={styles.optionsGrid}>
        {limitedOptions.map((option, index) => (
          <div key={option.id} className={styles.optionCard}>
            <div className={styles.optionHeader}>
              <span className={styles.optionLabel}>{index === 0 ? 'True' : 'False'}</span>
              <label className={styles.correctToggle}>
                <input
                  type="radio"
                  name="correct"
                  checked={option.isCorrect}
                  onChange={() => onSelectCorrect(option.id)}
                />
                <span>Correct</span>
              </label>
            </div>
            <label className={styles.explanationLabel}>
              Explanation
              <textarea
                value={option.explanation}
                onChange={(e) => onChangeExplanation(option.id, e.target.value)}
                placeholder="Explain why this option is correct or incorrect..."
                maxLength={250}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
