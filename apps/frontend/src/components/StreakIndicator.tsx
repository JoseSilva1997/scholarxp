// Displays the student's live session streak as a fire icon whose visual intensity
// matches the backend's XP bonus tier thresholds (30 % and 50 % of total questions).
// Intentionally mirrors `ExpCalculationService.resolveReachedStreakTier` so
// visual state and actual XP bonuses are always in sync.
import { motion, AnimatePresence } from 'motion/react';
import { FaFire } from 'react-icons/fa6';
import styles from './StreakIndicator.module.css';

// Streak tier mirrors the backend ExpCalculationService.resolveReachedStreakTier thresholds.
// 0 = dormant (< 3 correct or no valid streak yet)
// 1 = warm  (≥ 30 % of total questions answered correctly in a row) → first XP bonus tier
// 2 = hot   (≥ 50 % of total questions)                             → second XP bonus tier
// 3 = blaze (≥ 100 % of total questions — full clean run)
type StreakTier = 0 | 1 | 2 | 3;

// A pip maps to one XP bonus tier and shows whether the student is about to earn
// the bonus for the first time (active) or has already claimed it (claimed).
type PipState = 'inactive' | 'active' | 'claimed';

type StreakIndicatorProps = {
  // Live count of consecutive first-attempt correct answers for this session.
  currentStreak: number;
  // All-time highest streak in this session; determines which tier bonuses are
  // already claimed via idempotency keys vs still earnable.
  highestStreak: number;
  // Total number of questions in the unit; needed to compute relative thresholds.
  totalQuestions: number;
};

// Determines which visual tier to render based on the same percentage thresholds
// the backend uses for awarding streak XP bonuses.
function resolveStreakTier(
  currentStreak: number,
  totalQuestions: number,
): StreakTier {
  // Mirrors backend ExpCalculationService: units with fewer than 4 questions
  // don't participate in the streak mechanic so the icon stays dormant.
  if (totalQuestions < 4) {
    return 0;
  }
  // Thresholds are intentionally identical to backend's ExpCalculationService.
  const tierOne = Math.max(3, Math.ceil(totalQuestions * 0.3));
  const tierTwo = Math.max(3, Math.ceil(totalQuestions * 0.5));
  const tierThree = Math.max(3, totalQuestions);

  if (currentStreak >= tierThree) return 3;
  if (currentStreak >= tierTwo) return 2;
  if (currentStreak >= tierOne) return 1;
  return 0;
}

// Returns the pip state for a single bonus tier threshold.
// - active:   currentStreak just reached the threshold and highestStreak hasn't yet
//             → bonus will be awarded on this run (first time hitting this tier)
// - claimed:  highestStreak is already at or above the threshold
//             → bonus was already collected; re-reaching this tier won't give more XP
// - inactive: threshold not yet reached by the current streak
function resolvePipState(
  currentStreak: number,
  highestStreak: number,
  tierThreshold: number,
): PipState {
  if (highestStreak >= tierThreshold) return 'claimed';
  if (currentStreak >= tierThreshold) return 'active';
  return 'inactive';
}

// CSS module class names per tier; dormant coloring uses `tier0` to indicate
// the fire hasn't been "lit" yet.
const TIER_CLASS: Record<StreakTier, string> = {
  0: styles.tier0,
  1: styles.tier1,
  2: styles.tier2,
  3: styles.tier3,
};

// Accessible label for screen readers that describes the current streak intensity.
const TIER_LABEL: Record<StreakTier, string> = {
  0: 'No streak yet',
  1: 'Streak: warm',
  2: 'Streak: hot',
  3: 'Streak: blazing',
};

// Pip tier index → CSS class for the tier-specific color.
const PIP_TIER_CLASS: Record<1 | 2, string> = {
  1: styles.pipTier1,
  2: styles.pipTier2,
};

// Pip state → CSS class.
const PIP_STATE_CLASS: Record<PipState, string> = {
  inactive: styles.pipInactive,
  active: styles.pipActive,
  claimed: styles.pipClaimed,
};

// Human-readable accessible label for each pip state so screen readers announce bonus status.
function pipAriaLabel(tierIndex: 1 | 2, state: PipState): string {
  const tierName = tierIndex === 1 ? '30%' : '50%';
  if (state === 'active') return `${tierName} streak bonus: will be awarded`;
  if (state === 'claimed') return `${tierName} streak bonus: already earned`;
  return `${tierName} streak bonus: not reached`;
}

export default function StreakIndicator({
  currentStreak,
  highestStreak,
  totalQuestions,
}: StreakIndicatorProps) {
  const tier = resolveStreakTier(currentStreak, totalQuestions);
  // Show the count badge and pips on any eligible unit.
  const showBadge = totalQuestions >= 4;

  // Compute pip states only for eligible units; thresholds mirror resolveStreakTier.
  const tierOneThreshold = totalQuestions >= 4 ? Math.max(3, Math.ceil(totalQuestions * 0.3)) : Infinity;
  const tierTwoThreshold = totalQuestions >= 4 ? Math.max(3, Math.ceil(totalQuestions * 0.5)) : Infinity;
  const pip1State = showBadge ? resolvePipState(currentStreak, highestStreak, tierOneThreshold) : 'inactive';
  const pip2State = showBadge ? resolvePipState(currentStreak, highestStreak, tierTwoThreshold) : 'inactive';

  return (
    <div
      className={`${styles.container} ${TIER_CLASS[tier]}`}
      aria-label={`${TIER_LABEL[tier]}${showBadge ? ` — ${currentStreak} in a row` : ''}`}
      title={`${TIER_LABEL[tier]}${showBadge ? ` (${currentStreak})` : ''}`}
    >
        {/* Pip column: pip 1 = 30% threshold, pip 2 = 50% threshold.
          Inactive pips still render as dim outlines so the layout is stable
          and the student can see what's coming. Pips only appear on eligible
          units (4+ questions) where the streak mechanic is active. */}
      {showBadge && (
        <span className={styles.pips} aria-hidden="true">
          <span
            data-testid="pip-tier1"
            className={`${styles.pip} ${PIP_STATE_CLASS[pip1State]} ${PIP_TIER_CLASS[1]}`}
            aria-label={pipAriaLabel(1, pip1State)}
          />
          <span
            data-testid="pip-tier2"
            className={`${styles.pip} ${PIP_STATE_CLASS[pip2State]} ${PIP_TIER_CLASS[2]}`}
            aria-label={pipAriaLabel(2, pip2State)}
          />
        </span>
      )}
      {/* Scale the icon upward as tier grows to give a "growing flame" feel */}
      <motion.span
        className={styles.iconWrapper}
        animate={{ scale: 1 + tier * 0.1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        aria-hidden="true"
      >
        <FaFire className={styles.icon} />
      </motion.span>

      {/* Badge showing the streak count, visible on eligible units */}
      <AnimatePresence mode="wait">
        {showBadge && (
          <motion.span
            key={currentStreak}
            className={styles.badge}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            aria-hidden="true"
          >
            {currentStreak}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
