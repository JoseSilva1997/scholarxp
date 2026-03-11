// Displays whether the currently active question can still contribute to the
// session streak.
//   eligible   — amber flame, "a correct answer here will extend your streak"
//   ineligible — dimmed flame, "this question can no longer increment the streak"
//
// A question becomes ineligible once it has ever been answered correctly:
// answering it correctly again will not increment the streak counter. Getting
// it wrong first and then right on retry still counts, which is why eligibility
// is based on hasCorrectAttempt (ever correct) not the first-try bonus.
//
// Only renders in units with ≥ 4 questions where the streak mechanic is active.
import { FaFire } from 'react-icons/fa6';
import styles from './QuestionStreakIndicator.module.css';

export type QuestionStreakStatus = 'eligible' | 'ineligible';

type QuestionStreakIndicatorProps = {
  // Eligible when the question has never been answered correctly;
  // ineligible once a correct answer has been recorded.
  status: QuestionStreakStatus;
};

const STATE_CLASS: Record<QuestionStreakStatus, string> = {
  eligible: styles.stateEligible,
  ineligible: styles.stateIneligible,
};

const STATE_ARIA_LABEL: Record<QuestionStreakStatus, string> = {
  eligible: 'Streak: this question can still extend your streak',
  ineligible: 'Streak: this question can no longer increment the streak',
};

export default function QuestionStreakIndicator({ status }: QuestionStreakIndicatorProps) {
  return (
    // Wrapper carries the state class so the CSS descendant selector (.stateX .icon)
    // can target the icon without extra class juggling on the SVG element.
    <span
      className={`${styles.container} ${STATE_CLASS[status]}`}
      aria-label={STATE_ARIA_LABEL[status]}
      title={STATE_ARIA_LABEL[status]}
    >
      <FaFire className={styles.icon} aria-hidden="true" />
    </span>
  );
}
