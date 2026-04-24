// Displays the first-try bonus availability for the currently active question.
// Three states are shown:
//   available — amber target, "you can still earn the first-try bonus"
//   earned    — dimmed target + green checkmark, "you already earned it"
//   lost      — dimmed target + red cross, "you missed your chance"
// Placed to the left of StreakIndicator in the practice-room header so both
// per-question reward indicators are grouped together.
import { FaCheck, FaXmark } from 'react-icons/fa6';
import { TbTargetArrow } from "react-icons/tb";
import styles from '@/Practice-Room/components/FirstTryAccuracyIndicator.module.css';

// Explicit three-value status driven by combined live + server-snapshot data;
// callers resolve which state is active and pass a single clean value.
export type FirstTryBonusStatus = 'available' | 'earned' | 'lost';

type FirstTryAccuracyIndicatorProps = {
  // The resolved first-try bonus status for the active question.
  status: FirstTryBonusStatus;
  // Retry mode is review-only for rewards, so the accuracy indicator should render disabled.
  disabled?: boolean;
};

// CSS class applied to the container per status; controls icon colour and glow.
const STATE_CLASS: Record<FirstTryBonusStatus, string> = {
  available: styles.stateAvailable,
  earned: styles.stateEarned,
  lost: styles.stateLost,
};

// Human-readable label surfaced to screen readers.
const STATE_ARIA_LABEL: Record<FirstTryBonusStatus, string> = {
  available: 'First-try bonus: still available',
  earned: 'First-try bonus: already earned',
  lost: 'First-try bonus: lost',
};

export default function FirstTryAccuracyIndicator({
  status,
  disabled = false,
}: FirstTryAccuracyIndicatorProps) {
  const ariaLabel = disabled
    ? 'First-try bonus indicator disabled during retry review'
    : STATE_ARIA_LABEL[status];

  return (
    // Wrapper carries the state class so the CSS descendant selector (.stateX .icon)
    // can target the icon without extra class juggling on the SVG element.
    <span
      className={`${styles.container} ${disabled ? styles.stateDisabled : STATE_CLASS[status]}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {/* iconWrapper keeps relative positioning for the overlay badge. */}
      <span className={styles.iconWrapper} aria-hidden="true">
        <TbTargetArrow className={styles.icon} />
        {!disabled && status === 'earned' && (
          <span className={`${styles.overlayBadge} ${styles.overlayBadgeEarned}`}>
            <FaCheck className={styles.overlayIcon} />
          </span>
        )}
        {!disabled && status === 'lost' && (
          <span className={`${styles.overlayBadge} ${styles.overlayBadgeLost}`}>
            <FaXmark className={styles.overlayIcon} />
          </span>
        )}
      </span>
    </span>
  );
}
