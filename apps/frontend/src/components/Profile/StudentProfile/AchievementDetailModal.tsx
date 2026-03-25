// Explains achievement requirements in one place so locked cards can stay compact without hiding progression rules.
import { createPortal } from 'react-dom';
import { useEffect, type ReactNode } from 'react';
import { FaLock } from 'react-icons/fa6';
import { AnimatePresence, motion } from 'motion/react';
import styles from '../StudentProfile.module.css';

type AchievementDetail = {
  id: string;
  name: string;
  icon: ReactNode;
  tier: 1 | 2 | 3 | 4;
  requirement: string;
  progressDetail: string;
  statusDetail: string;
  earned: boolean;
};

type AchievementDetailModalProps = {
  achievement: AchievementDetail | null;
  onClose: () => void;
};

// Per-tier class maps — keeps the render logic readable and avoids template-literal class lookups
const TIER_RING_CLASS: Record<number, string> = {
  1: styles.achievementModalIconRingTier1,
  2: styles.achievementModalIconRingTier2,
  3: styles.achievementModalIconRingTier3,
  4: styles.achievementModalIconRingTier4,
};

const TIER_ICON_CLASS: Record<number, string> = {
  1: styles.achievementModalIconTier1,
  2: styles.achievementModalIconTier2,
  3: styles.achievementModalIconTier3,
  4: styles.achievementModalIconTier4,
};

const TIER_HERO_CLASS: Record<number, string> = {
  1: styles.achievementModalHeroTier1,
  2: styles.achievementModalHeroTier2,
  3: styles.achievementModalHeroTier3,
  4: styles.achievementModalHeroTier4,
};

const TIER_GLOW_CLASS: Record<number, string> = {
  1: styles.achievementModalGlowTier1,
  2: styles.achievementModalGlowTier2,
  3: styles.achievementModalGlowTier3,
  4: styles.achievementModalGlowTier4,
};

const TIER_MODAL_CLASS: Record<number, string> = {
  1: styles.achievementModalOuterTier1,
  2: styles.achievementModalOuterTier2,
  3: styles.achievementModalOuterTier3,
  4: styles.achievementModalOuterTier4,
};

function AchievementModalContent({
  achievement,
  onClose,
}: {
  achievement: AchievementDetail;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const titleId = `${achievement.id}-title`;
  const bodyId = `${achievement.id}-body`;

  const heroClass = achievement.earned
    ? (TIER_HERO_CLASS[achievement.tier] ?? '')
    : styles.achievementModalHeroLocked;

  const glowClass = achievement.earned ? (TIER_GLOW_CLASS[achievement.tier] ?? '') : '';
  const ringClass = achievement.earned
    ? (TIER_RING_CLASS[achievement.tier] ?? '')
    : styles.achievementModalIconRingLocked;
  const iconClass = achievement.earned
    ? (TIER_ICON_CLASS[achievement.tier] ?? '')
    : styles.achievementModalIconLocked;
  const modalOuterClass = achievement.earned ? (TIER_MODAL_CLASS[achievement.tier] ?? '') : '';

  return (
    <motion.div
      className={styles.achievementModalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClick={onClose}
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className={`${styles.achievementModal} ${modalOuterClass}`}
        onClick={(event) => event.stopPropagation()}
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350, mass: 1 }}
      >
        <button
          type="button"
          className={styles.achievementModalClose}
          onClick={onClose}
          aria-label="Close achievement details"
        >
          ×
        </button>

        <div className={`${styles.achievementModalHero} ${heroClass}`}>
          <motion.div
            className={`${styles.achievementModalIconRing} ${ringClass}`}
            initial={{ scale: 0.5, opacity: 0, rotate: achievement.earned ? -15 : 0, y: 0 }}
            animate={
              achievement.earned
                ? { scale: 1, opacity: 1, rotate: 0, y: [0, -5, 0] }
                : { scale: 1, opacity: 1, rotate: 0, y: 0 }
            }
            transition={
              achievement.earned
                ? {
                    scale: { type: 'spring', delay: 0.1, damping: 15, stiffness: 300 },
                    opacity: { delay: 0.1, duration: 0.3 },
                    rotate: { type: 'spring', delay: 0.1, damping: 15, stiffness: 300 },
                    y: {
                      repeat: Infinity,
                      duration: 4,
                      ease: 'easeInOut',
                      delay: 0.8,
                    },
                  }
                : { type: 'spring', delay: 0.1, damping: 15, stiffness: 300 }
            }
          >
            <span className={`${styles.achievementModalIconSize} ${iconClass}`}>
              {achievement.earned ? achievement.icon : <FaLock />}
            </span>
          </motion.div>

          <motion.div 
            className={styles.achievementModalMeta}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <h3 id={titleId} className={styles.achievementModalTitle}>
              {achievement.name}
            </h3>
            <span
              className={`${styles.achievementStatusBadge} ${
                achievement.earned
                  ? styles.achievementStatusBadgeEarnedDark
                  : styles.achievementStatusBadgeLockedDark
              }`}
            >
              {achievement.earned ? 'Completed' : 'Locked'}
            </span>
          </motion.div>
        </div>

        <div id={bodyId} className={styles.achievementModalBody}>
          <p className={styles.achievementModalRequirement}>{achievement.requirement}</p>
          <motion.div 
            className={styles.achievementModalProgressCard}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <span className={styles.achievementModalLabel}>Progress</span>
            <strong className={styles.achievementModalProgressValue}>
              {achievement.progressDetail}
            </strong>
            <span className={styles.achievementModalStatus}>{achievement.statusDetail}</span>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AchievementDetailModal({
  achievement,
  onClose,
}: AchievementDetailModalProps) {
  // Use createPortal carefully around AnimatePresence to ensure 
  // it correctly animates unmount logic off the document body. 
  return createPortal(
    <AnimatePresence>
      {achievement && (
        <AchievementModalContent key="achievement-modal" achievement={achievement} onClose={onClose} />
      )}
    </AnimatePresence>,
    document.body,
  );
}
