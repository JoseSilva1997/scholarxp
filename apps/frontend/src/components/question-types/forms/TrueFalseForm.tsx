// Renders a True/False answer form; uses first two options from parent-controlled state.
import styles from './QuestionTypeForms.module.css';

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

export function TrueFalseForm({
  options,
  onChangeOption,
  onChangeExplanation,
  onSelectCorrect,
}: TrueFalseFormProps) {
  const limitedOptions = options.slice(0, 2);
  return (
    <div className={styles.optionsSection}>
      <h3>Answer Options (True / False)</h3>
      <div className={styles.optionsGrid}>
        {limitedOptions.map((option, index) => (
          <div key={option.id} className={styles.optionCard}>
            <div className={styles.optionHeader}>
              <span className={styles.optionLabel}>{index === 0 ? 'Option 1' : 'Option 2'}</span>
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
            <input
              value={option.value}
              onChange={(e) => onChangeOption(option.id, e.target.value)}
              placeholder={`Enter ${index === 0 ? 'Option 1' : 'Option 2'} text...`}
              className={styles.optionInput}
              maxLength={100}
            />
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
