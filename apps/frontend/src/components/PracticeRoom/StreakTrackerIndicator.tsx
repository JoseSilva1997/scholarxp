// Displays the student's live session streak as a fire icon. Supports two variants:
// 'practice-room' — mirrors ExpCalculationService XP bonus thresholds (30%/50%/100%),
// shows pip indicators, and animates bonus notifications; gates streak on ≥4 questions.
// 'daily-practice' — always shows streak regardless of question count; no pips or
// bonus animation since daily practice does not award account XP streak bonuses.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FaFire } from 'react-icons/fa6';
import styles from './StreakTrackerIndicator.module.css';

// Streak tier mirrors the backend ExpCalculationService.resolveReachedStreakTier thresholds,
// with an additional tier0 tier 1 for subtle blue before the first XP bonus tier kicks in.
// 0 = disabled  (streak = 0; no valid streak yet)
// 1 = subtle    (1 ≤ streak < 30 % of total questions)
// 2 = warm      (≥ 30 % of total questions answered correctly) → first XP bonus tier
// 3 = hot       (≥ 50 % of total questions)                     → second XP bonus tier
// 4 = blaze     (≥ 100 % of total questions — full clean run)
type StreakTier = 0 | 1 | 2 | 3 | 4;

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
  // Controls which feature set is active. 'practice-room' is the full XP-bonus
  // mode with pips and bonus animation; 'daily-practice' is display-only with no
  // thresholds or bonus notifications. Defaults to 'practice-room'.
  variant?: 'practice-room' | 'daily-practice';
  // Retry mode keeps practice interactive but disables reward affordances entirely.
  disabled?: boolean;
};

// Determines which visual tier to render based on the same percentage thresholds
// the backend uses for awarding streak XP bonuses. Returns tier 1 (subtle blue)
// for streaks between 1 and the first bonus tier.
function resolveStreakTier(
  currentStreak: number,
  totalQuestions: number,
): StreakTier {
  // Streak disabled if no valid streak yet or insufficient questions
  if (currentStreak === 0 || totalQuestions < 4) {
    return 0;
  }
  // Thresholds are intentionally identical to backend's ExpCalculationService.
  const tierOne = Math.max(3, Math.ceil(totalQuestions * 0.3));
  const tierTwo = Math.max(3, Math.ceil(totalQuestions * 0.5));
  const tierThree = Math.max(3, totalQuestions);

  if (currentStreak >= tierThree) return 4;
  if (currentStreak >= tierTwo) return 3;
  if (currentStreak >= tierOne) return 2;
  // currentStreak is between 1 and tierOne threshold
  return 1;
}

// Determines visual tier for daily practice using absolute thresholds rather than
// question-count-relative ones. Daily practice sets vary in size and carry no XP
// streak bonuses, so a fixed progression gives useful visual feedback without
// implying any particular bonus will fire.
function resolveStreakTierForDailyPractice(currentStreak: number): StreakTier {
  if (currentStreak === 0) return 0;
  if (currentStreak >= 10) return 4;
  if (currentStreak >= 6) return 3;
  if (currentStreak >= 3) return 2;
  return 1;
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

// CSS module class names per tier.
const TIER_CLASS: Record<StreakTier, string> = {
  0: styles.tier0,
  1: styles.tier1,
  2: styles.tier2,
  3: styles.tier3,
  4: styles.tier4,
};

// Accessible label for screen readers that describes the current streak intensity.
const TIER_LABEL: Record<StreakTier, string> = {
  0: 'No streak yet',
  1: 'Streak: building',
  2: 'Streak: warm',
  3: 'Streak: hot',
  4: 'Streak: blazing',
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
  variant = 'practice-room',
  disabled = false,
}: StreakIndicatorProps) {
  const isDailyPractice = variant === 'daily-practice';

  const tier = disabled
    ? 0
    : isDailyPractice
    ? resolveStreakTierForDailyPractice(currentStreak)
    : resolveStreakTier(currentStreak, totalQuestions);

  // Daily practice always shows the badge; practice-room gates it on 4+ questions
  // because the XP streak mechanic is suppressed on smaller units.
  const showBadge = !disabled && (isDailyPractice || totalQuestions >= 4);

  // Pip state is only relevant in practice-room mode where XP bonuses fire.
  const tierOneThreshold =
    !disabled && !isDailyPractice && totalQuestions >= 4
      ? Math.max(3, Math.ceil(totalQuestions * 0.3))
      : Infinity;
  const tierTwoThreshold =
    !disabled && !isDailyPractice && totalQuestions >= 4
      ? Math.max(3, Math.ceil(totalQuestions * 0.5))
      : Infinity;
  const tierThreeThreshold =
    !disabled && !isDailyPractice && totalQuestions >= 4
      ? totalQuestions
      : Infinity;
  // Pass lifetime-claimed status so entering the room pre-populates claimed pips
  // from the backend's streakRewardState, not just this session's highestStreak.
  const pip1State = showBadge && !isDailyPractice ? resolvePipState(currentStreak, highestStreak, tierOneThreshold, claimedTiers.includes(1)) : 'inactive';
  const pip2State = showBadge && !isDailyPractice ? resolvePipState(currentStreak, highestStreak, tierTwoThreshold, claimedTiers.includes(2)) : 'inactive';
  const pip3State = showBadge && !isDailyPractice ? resolvePipState(currentStreak, highestStreak, tierThreeThreshold, claimedTiers.includes(3)) : 'inactive';

  // Track the previous highestStreak for threshold-crossing detection.
  const prevHighestStreakRef = useRef(highestStreak);
  const [showFloatingBonus, setShowFloatingBonus] = useState(false);
  // Tracks whether isStreakInitialized was true on the *previous* effect run.
  // Used to detect the initialization transition (false → true) so we can
  // silently capture the real initial highestStreak as our comparison baseline,
  // preventing a false "Bonus!" when async data first arrives on refresh.
  const prevIsStreakInitializedRef = useRef(isStreakInitialized);

  // Detect when highestStreak crossed a bonus tier threshold during active play.
  // Skipped entirely in daily-practice mode since no XP bonuses are awarded there.
  useEffect(() => {
    if (disabled || isDailyPractice) {
      prevHighestStreakRef.current = highestStreak;
      return;
    }

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
    const t1 = showBadgeThreshold ? Math.max(3, Math.ceil(totalQuestions * 0.3)) : Infinity;
    const t2 = showBadgeThreshold ? Math.max(3, Math.ceil(totalQuestions * 0.5)) : Infinity;
    const t3 = showBadgeThreshold ? totalQuestions : Infinity;

    // A bonus was earned if highestStreak just crossed a threshold.
    const bonusEarned =
      (prevHighestStreak < t1 && highestStreak >= t1) ||
      (prevHighestStreak < t2 && highestStreak >= t2) ||
      (prevHighestStreak < t3 && highestStreak >= t3);

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
  }, [disabled, highestStreak, totalQuestions, isStreakInitialized, isDailyPractice])

  return (
    <div
      className={`${styles.container} ${TIER_CLASS[tier]}`}
      aria-label={
        disabled
          ? 'Streak rewards disabled during retry review'
          : `${TIER_LABEL[tier]}${showBadge ? ` — ${currentStreak} in a row` : ''}`
      }
      title={
        disabled
          ? 'Streak rewards disabled during retry review'
          : `${TIER_LABEL[tier]}${showBadge ? ` (${currentStreak})` : ''}`
      }
    >
      {/* Floating "Bonus!" text that appears when a pip earns a bonus for the first time.
          Not rendered in daily-practice mode since no XP streak bonuses fire there. */}
      <AnimatePresence>
        {!isDailyPractice && showFloatingBonus && (
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
        {/* Scale the icon upward as tier grows to give a "growing flame" feel,
            but keep growth subtle (5% per tier) so it doesn't overflow the container */}
        <motion.span
          className={styles.iconWrapper}
          animate={{ scale: 1 + tier * 0.05 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          aria-hidden="true"
        >
          <FaFire className={styles.icon} />
        </motion.span>

        {/* Pips arranged horizontally below flame: pip 1 = 30%, pip 2 = 50%, pip 3 = 100% threshold.
            Inactive pips still render as dim outlines so the layout is stable
            and the student can see what's coming. Pips only appear in practice-room
            mode on eligible units (4+ questions) where XP streak bonuses are active. */}
        {showBadge && !isDailyPractice && (
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
