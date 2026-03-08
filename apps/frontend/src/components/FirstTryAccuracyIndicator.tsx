// Displays a visual cue for the student's first-try accuracy on the currently active
// question. Lights up green when the backend awards a firstAttemptBonus (question answered
// correctly on the very first attempt), turns red on an incorrect answer, and stays neutral
// when the question hasn't been answered yet or the student is retrying.
// Placed to the left of StreakIndicator in the practice-room header so both live-feedback
// indicators are grouped together.
import { TbTargetArrow } from "react-icons/tb";
import styles from './FirstTryAccuracyIndicator.module.css';

// Mirrors the string literals used in usePracticeRoomPageState / useSubmitAttempt so
// callers share a single contract without importing from hook files.
export type FirstTryAccuracyResult = 'first-try-correct' | 'incorrect' | null;

type FirstTryAccuracyIndicatorProps = {
  // The outcome of the last submitted attempt for the active question.
  // null = not yet answered (or student just clicked "Try Again").
  result: FirstTryAccuracyResult;
};

// CSS class applied to the container per result state; controls the indicator colour
// and optional glow animation without duplicating variables in the component.
const STATE_CLASS: Record<'none' | 'first-try-correct' | 'incorrect', string> = {
  none: styles.stateNone,
  'first-try-correct': styles.stateCorrect,
  incorrect: styles.stateIncorrect,
};

// Human-readable label surfaced to screen readers so the indicator's meaning
// is announced without requiring the user to interpret colour alone.
const STATE_ARIA_LABEL: Record<'none' | 'first-try-correct' | 'incorrect', string> = {
  none: 'First-try accuracy: no answer yet',
  'first-try-correct': 'First try! Bonus XP earned',
  incorrect: 'Incorrect answer',
};

export default function FirstTryAccuracyIndicator({ result }: FirstTryAccuracyIndicatorProps) {
  // Normalise null to the string key 'none' so the record lookups above stay exhaustive.
  const stateKey = result ?? 'none';

  return (
    <div
      className={`${styles.container} ${STATE_CLASS[stateKey]}`}
      aria-label={STATE_ARIA_LABEL[stateKey]}
      title={STATE_ARIA_LABEL[stateKey]}
    >
      {/* AnimatePresence re-mounts the icon whenever the result changes so the
          spring entrance animation plays on every state transition, giving a
          satisfying "snap" that draws the student's attention to the feedback. */}
      {/* No entrance animation — instant colour switch keeps feedback snappy */}
      <span className={styles.iconWrapper} aria-hidden="true">
        <TbTargetArrow className={styles.icon} />
      </span>
    </div>
  );
}
