// Renders an MCQ answer form: options, correctness toggle, and explanations; state is controlled by parent.
import styles from './QuestionTypeForms.module.css';

type McqOption = {
  id: string;
  value: string;
  isCorrect: boolean;
  explanation: string;
};

type McqFormProps = {
  options: McqOption[];
  onChangeOption: (id: string, value: string) => void;
  onChangeExplanation: (id: string, value: string) => void;
  onSelectCorrect: (id: string) => void;
};

export function McqForm({ options, onChangeOption, onChangeExplanation, onSelectCorrect }: McqFormProps) {
  return (
    <div className={styles.optionsSection}>
      <h3>Answer Options</h3>
      <div className={styles.optionsGrid}>
        {options.map((option, index) => (
          <div key={option.id} className={styles.optionCard}>
            <div className={styles.optionHeader}>
              <span className={styles.optionLabel}>Option {index + 1}</span>
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
              placeholder="Enter option text..."
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
