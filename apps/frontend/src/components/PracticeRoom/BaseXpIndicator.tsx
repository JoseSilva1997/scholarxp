// Displays the base XP availability for the currently active question.
// Two states are shown:
//   available — amber/glowing bolt, "you can still earn base XP for this question"
//   claimed   — dimmed bolt, "base XP was already earned for this question"
// Base XP status is also the user-facing proxy for per-question streak eligibility:
// if base XP is still available, this question can still contribute to streak growth.
// Placed in the practice-room header alongside FirstTryAccuracyIndicator and
// StreakIndicator so all per-question reward signals are grouped together.
import { FaBolt, FaCheck } from 'react-icons/fa6';
import styles from './BaseXpIndicator.module.css';

// Two-value status driven by the server-side rewardState snapshot on room load;
// updates in response to a successful submission via re-derived indicator data.
export type BaseXpStatus = 'available' | 'claimed';

type BaseXpIndicatorProps = {
  // Whether base XP can still be earned for the active question.
  status: BaseXpStatus;
};

// CSS class applied to the container per status.
const STATE_CLASS: Record<BaseXpStatus, string> = {
  available: styles.stateAvailable,
  claimed: styles.stateClaimed,
};

// Accessible labels announced to screen readers.
const STATE_ARIA_LABEL: Record<BaseXpStatus, string> = {
  available: 'Base XP: still available (can contribute to streak)',
  claimed: 'Base XP: already earned (cannot contribute to streak)',
};

export default function BaseXpIndicator({ status }: BaseXpIndicatorProps) {
  return (
    // Wrapper carries the state class so the CSS descendant selector (.stateX .icon)
    // can target the icon without extra class juggling on the SVG element.
    <span
      className={`${styles.container} ${STATE_CLASS[status]}`}
      aria-label={STATE_ARIA_LABEL[status]}
      title={STATE_ARIA_LABEL[status]}
    >
      {/* iconWrapper keeps relative positioning for the overlay badge. */}
      <span className={styles.iconWrapper} aria-hidden="true">
        <FaBolt className={styles.icon} />
        {status === 'claimed' && (
          <span className={styles.overlayBadge}>
            <FaCheck className={styles.overlayIcon} />
          </span>
        )}
      </span>
    </span>
  );
}
