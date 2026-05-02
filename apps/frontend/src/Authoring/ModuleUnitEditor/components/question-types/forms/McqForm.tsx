// Renders an MCQ answer form: options, correctness toggle, and explanations; state is controlled by parent.
import { useState, useRef, useEffect } from 'react';
import type { BaseQuestionFormProps } from '@/Authoring/ModuleUnitEditor/components/question-types/QuestionTypeRegistry';
import styles from '@/Authoring/ModuleUnitEditor/components/question-types/forms/QuestionTypeForms.module.css';
import { MdBackspace } from "react-icons/md";
import { FiInfo } from 'react-icons/fi';

type McqFormProps = BaseQuestionFormProps;

// Renders the multiple-choice-specific form controls within the generic editor form contract.
export function McqForm({ options, onChangeOption, onChangeExplanation, onSelectCorrect, onDeleteOption }: McqFormProps) {
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

  return (
    <div className={styles.optionsSection}>
      <div className={styles.sectionHeadingRow} ref={popoverRef}>
        <h3>Answer Options</h3>
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
      <div className={styles.optionsList}>
        {options.map((option, index) => (
          <div key={option.id} className={styles.optionRow}>
            {/* Drag handle — visual affordance for future reordering; not wired to DnD yet */}
            <span className={styles.dragHandle} aria-hidden="true">⠿</span>
            <label className={styles.correctToggle}>
              <input
                type="radio"
                name="correct"
                checked={option.isCorrect}
                onChange={() => onSelectCorrect(option.id)}
              />
              <span>Correct</span>
            </label>
            <div className={styles.optionContent}>
              <div className={styles.fieldGroup}>
                <textarea
                  value={option.value}
                  onChange={(e) => onChangeOption(option.id, e.target.value)}
                  placeholder={`Option ${index + 1} text...`}
                  className={styles.compactTextarea}
                  maxLength={200}
                />
              </div>
              <div className={styles.fieldGroup}>
                <textarea
                  value={option.explanation}
                  onChange={(e) => onChangeExplanation(option.id, e.target.value)}
                  placeholder="Explain why this is correct or incorrect..."
                  className={styles.compactTextarea}
                  maxLength={250}
                />
              </div>
            </div>
            {onDeleteOption && (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => onDeleteOption(option.id)}
                aria-label={`Clear option ${index + 1}`}
              >
                {/*TODO: Replace with appropriate delete icon when delete functionality is implemented */}
                <MdBackspace />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
