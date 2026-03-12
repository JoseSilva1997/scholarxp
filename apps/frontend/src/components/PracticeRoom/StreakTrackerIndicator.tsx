// Displays the student's live session streak as a fire icon whose visual intensity
// matches the backend's XP bonus tier thresholds (30 % and 50 % of total questions).
// Intentionally mirrors `ExpCalculationService.resolveReachedStreakTier` so
// visual state and actual XP bonuses are always in sync.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FaFire } from 'react-icons/fa6';
import styles from './StreakTrackerIndicator.module.css';

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
  // True once the page-state hook has seeded streak values from the initial API
  // response. Bonus detection is suppressed until this is true to avoid a false
  // positive when the async load transitions highestStreak from 0 → real value.
  // Defaults to true so uses outside the practice-room page state (e.g. tests,
  // Storybook) don't need to supply it.
  isStreakInitialized?: boolean;
  // Lifetime-claimed tier numbers from the backend (1, 2, or 3). Populated on
  // room load so pips reflect the student's all-time achievements from the very
  // first render — before any new streak is built in the current session.
  // Defaults to [] so callers outside the practice room don't need to supply it.
  claimedTiers?: number[];
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
// - claimed:  tier is lifetime-claimed (backend idempotency key already used) OR
//             highestStreak reached the threshold this session; either way the
//             bonus XP won't be awarded again for this tier.
// - inactive: threshold not yet reached by the current streak
function resolvePipState(
  currentStreak: number,
  highestStreak: number,
  tierThreshold: number,
  // True when the backend confirms this tier's bonus has been issued in a prior
  // session. Showing it as claimed on room load is the whole point of this param.
  isLifetimeClaimed: boolean,
): PipState {
  if (isLifetimeClaimed || highestStreak >= tierThreshold) return 'claimed';
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
const PIP_TIER_CLASS: Record<1 | 2 | 3, string> = {
  1: styles.pipTier1,
  2: styles.pipTier2,
  3: styles.pipTier3,
};

// Pip state → CSS class.
const PIP_STATE_CLASS: Record<PipState, string> = {
  inactive: styles.pipInactive,
  active: styles.pipActive,
  claimed: styles.pipClaimed,
};

// Human-readable accessible label for each pip state so screen readers announce bonus status.
function pipAriaLabel(tierIndex: 1 | 2 | 3, state: PipState): string {
  const tierName = tierIndex === 1 ? '30%' : tierIndex === 2 ? '50%' : '100%';
  if (state === 'active') return `${tierName} streak bonus: will be awarded`;
  if (state === 'claimed') return `${tierName} streak bonus: already earned`;
  return `${tierName} streak bonus: not reached`;
}

export default function StreakIndicator({
  currentStreak,
  highestStreak,
  totalQuestions,
  isStreakInitialized = true,
  claimedTiers = [],
}: StreakIndicatorProps) {
  const tier = resolveStreakTier(currentStreak, totalQuestions);
  // Show the count badge and pips on any eligible unit.
  const showBadge = totalQuestions >= 4;

  // Compute pip states only for eligible units; thresholds mirror resolveStreakTier.
  const tierOneThreshold = totalQuestions >= 4 ? Math.max(3, Math.ceil(totalQuestions * 0.3)) : Infinity;
  const tierTwoThreshold = totalQuestions >= 4 ? Math.max(3, Math.ceil(totalQuestions * 0.5)) : Infinity;
  const tierThreeThreshold = totalQuestions >= 4 ? totalQuestions : Infinity;
  // Pass lifetime-claimed status so entering the room pre-populates claimed pips
  // from the backend's streakRewardState, not just this session's highestStreak.
  const pip1State = showBadge ? resolvePipState(currentStreak, highestStreak, tierOneThreshold, claimedTiers.includes(1)) : 'inactive';
  const pip2State = showBadge ? resolvePipState(currentStreak, highestStreak, tierTwoThreshold, claimedTiers.includes(2)) : 'inactive';
  const pip3State = showBadge ? resolvePipState(currentStreak, highestStreak, tierThreeThreshold, claimedTiers.includes(3)) : 'inactive';

  // Track the previous highestStreak for threshold-crossing detection.
  const prevHighestStreakRef = useRef(highestStreak);
  const [showFloatingBonus, setShowFloatingBonus] = useState(false);
  // Tracks whether isStreakInitialized was true on the *previous* effect run.
  // Used to detect the initialization transition (false → true) so we can
  // silently capture the real initial highestStreak as our comparison baseline,
  // preventing a false "Bonus!" when async data first arrives on refresh.
  const prevIsStreakInitializedRef = useRef(isStreakInitialized);

  // Detect when highestStreak crossed a bonus tier threshold during active play.
  useEffect(() => {
    const wasInitialized = prevIsStreakInitializedRef.current;
    prevIsStreakInitializedRef.current = isStreakInitialized;

    if (!isStreakInitialized || !wasInitialized) {
      // Either: still waiting for the API to return the initial data, OR
      // the initialization just completed this render (highestStreak jumped
      // from 0 to the real seeded value — not a genuine bonus earn).
      // Silently update the baseline so the next real submission diffs correctly.
      prevHighestStreakRef.current = highestStreak;
      return;
    }

    const prevHighestStreak = prevHighestStreakRef.current;
    const showBadgeThreshold = totalQuestions >= 4;

    // Calculate thresholds and check if highestStreak just crossed any of them.
    const tierOneThreshold = showBadgeThreshold ? Math.max(3, Math.ceil(totalQuestions * 0.3)) : Infinity;
    const tierTwoThreshold = showBadgeThreshold ? Math.max(3, Math.ceil(totalQuestions * 0.5)) : Infinity;
    const tierThreeThreshold = showBadgeThreshold ? totalQuestions : Infinity;

    // A bonus was earned if highestStreak just crossed a threshold.
    const bonusEarned =
      (prevHighestStreak < tierOneThreshold && highestStreak >= tierOneThreshold) ||
      (prevHighestStreak < tierTwoThreshold && highestStreak >= tierTwoThreshold) ||
      (prevHighestStreak < tierThreeThreshold && highestStreak >= tierThreeThreshold);

    prevHighestStreakRef.current = highestStreak;

    if (bonusEarned) {
      let hideTimer: ReturnType<typeof setTimeout> | null = null;
      // Defer state writes to the next frame to satisfy hook linting and keep
      // animation timing aligned with the rendered streak update.
      const frameId = requestAnimationFrame(() => {
        setShowFloatingBonus(true);
        // Auto-hide after animation completes (800ms).
        hideTimer = setTimeout(() => setShowFloatingBonus(false), 800);
      });
      return () => {
        cancelAnimationFrame(frameId);
        if (hideTimer !== null) {
          clearTimeout(hideTimer);
        }
      };
    }
  }, [highestStreak, totalQuestions, isStreakInitialized])

  return (
    <div
      className={`${styles.container} ${TIER_CLASS[tier]}`}
      aria-label={`${TIER_LABEL[tier]}${showBadge ? ` — ${currentStreak} in a row` : ''}`}
      title={`${TIER_LABEL[tier]}${showBadge ? ` (${currentStreak})` : ''}`}
    >
      {/* Floating "Bonus!" text that appears when a pip earns a bonus for the first time */}
      <AnimatePresence>
        {showFloatingBonus && (
          <motion.div
            className={styles.floatingBonus}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            aria-live="polite"
            aria-label="Bonus earned!"
          >
            Bonus!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group flame and pips vertically; badge stays to the right */}
      <span className={styles.iconPipGroup}>
        {/* Scale the icon upward as tier grows to give a "growing flame" feel */}
        <motion.span
          className={styles.iconWrapper}
          animate={{ scale: 1 + tier * 0.1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          aria-hidden="true"
        >
          <FaFire className={styles.icon} />
        </motion.span>

        {/* Pips arranged horizontally below flame: pip 1 = 30%, pip 2 = 50%, pip 3 = 100% threshold.
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
            <span
              data-testid="pip-tier3"
              className={`${styles.pip} ${PIP_STATE_CLASS[pip3State]} ${PIP_TIER_CLASS[3]}`}
              aria-label={pipAriaLabel(3, pip3State)}
            />
          </span>
        )}
      </span>

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
