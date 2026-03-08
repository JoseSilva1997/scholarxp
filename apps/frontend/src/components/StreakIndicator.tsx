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

type StreakIndicatorProps = {
  // Live count of consecutive first-attempt correct answers for this session.
  currentStreak: number;
  // Total number of questions in the unit; needed to compute relative thresholds.
  totalQuestions: number;
};

// Determines which visual tier to render based on the same percentage thresholds
// the backend uses for awarding streak XP bonuses.
function resolveStreakTier(
  currentStreak: number,
  totalQuestions: number,
): StreakTier {
  // Backend minimum is 3 correct answers before any tier is reachable.
  if (totalQuestions <= 0 || currentStreak < 3) {
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

export default function StreakIndicator({
  currentStreak,
  totalQuestions,
}: StreakIndicatorProps) {
  const tier = resolveStreakTier(currentStreak, totalQuestions);
  const isActive = tier > 0;

  return (
    <div
      className={`${styles.container} ${TIER_CLASS[tier]}`}
      aria-label={`${TIER_LABEL[tier]}${isActive ? ` — ${currentStreak} in a row` : ''}`}
      title={`${TIER_LABEL[tier]}${isActive ? ` (${currentStreak})` : ''}`}
    >
      {/* Scale the icon upward as tier grows to give a "growing flame" feel */}
      <motion.span
        className={styles.iconWrapper}
        animate={{ scale: 1 + tier * 0.1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        aria-hidden="true"
      >
        <FaFire className={styles.icon} />
      </motion.span>

      {/* Badge showing the streak count, only visible when streak is active */}
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.span
            key={currentStreak}
            className={styles.badge}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            aria-hidden="true"
          >
            {currentStreak}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
