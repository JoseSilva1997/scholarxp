import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getProgressWithinLevel } from '@scholarxp/progression';
import type { AuthUser } from '@scholarxp/api-contracts';
import { getNewlyUnlockedRewards, type CatalogItem } from '@/Rewards/cosmetics';
import defaultAvatar from '@/assets/default-profile-pic.png';
import UnlockToast from '@/Rewards/RewardsPage/components/UnlockToast';
import UserBadgeMenu from '@/MainApp/Header/UserBadge/UserBadgeMenu';
import styles from '@/MainApp/Header/UserBadge/UserBadge.module.css';

type UserBadgeProps = {
  user: AuthUser;
  onLogout?: () => Promise<void> | void;
};

function formatName(user: AuthUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

// Deterministic particle offsets for the level-up burst to avoid impure render logic and flickering
const LEVEL_UP_PARTICLE_OFFSETS = [
  { x: 45, y: -15, delay: 0.0 },
  { x: -35, y: -35, delay: 0.04 },
  { x: 15, y: 45, delay: 0.08 },
  { x: -45, y: 15, delay: 0.12 },
  { x: 30, y: 35, delay: 0.02 },
  { x: -15, y: -45, delay: 0.06 },
  { x: 50, y: 5, delay: 0.10 },
  { x: -50, y: -5, delay: 0.14 }
];

// SVG ring dimensions — viewBox 52×52, wrapper = avatar+12px, so inner edge ≈ avatar edge
const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 138.23px

export default function UserBadge({ user, onLogout }: UserBadgeProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [displayedTotalExp, setDisplayedTotalExp] = useState<number | null>(null);
  const [expGainIndicator, setExpGainIndicator] = useState<number | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [isBadgeCrashing, setIsBadgeCrashing] = useState(false);
  // Queued cosmetic unlocks shown in a toast after the level-up celebration finishes.
  const [unlockedItems, setUnlockedItems] = useState<CatalogItem[]>([]);
  const unlockToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ring owns its own percent + transition duration so it can sequence fill→pause→reset→fill
  // independently of the XP counter animation that drives the displayed numbers.
  const [ringPercent, setRingPercent] = useState<number | null>(null);
  const [ringTransitionMs, setRingTransitionMs] = useState(0);
  const prevTargetLevelRef = useRef<number | null>(null);
  const levelingUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uncrashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expAnimationFrameRef = useRef<number | null>(null);
  const expGainIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedTotalExpRef = useRef<number | null>(null);
  // Ref mirrors ringPercent state so setTimeout callbacks can read the latest commanded value
  // without capturing stale closure state.
  const ringPercentRef = useRef<number | null>(null);
  const ringAnimTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const toggleMenu = () => setIsMenuOpen((open) => !open);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarSrc =
    user.profilePictureUrl && user.profilePictureUrl.startsWith('http')
      ? user.profilePictureUrl
      : defaultAvatar;

  const isStudent = user.globalRole === 'student';
  const targetTotalExp = isStudent && user.avatar ? user.avatar.totalExp : null;

  const animatedProgress =
    targetTotalExp !== null
      ? getProgressWithinLevel(displayedTotalExp ?? targetTotalExp)
      : null;

  useEffect(() => {
    if (targetTotalExp === null) return;

    const progress = getProgressWithinLevel(targetTotalExp);
    const nextLevel = progress.level;
    // Clamp to avoid floating-point overshoot beyond 100 which would hide the fill start on reset.
    const targetPercent = Math.min(100, Math.round(progress.progressPercent));

    // First boot: snap ring to current state with no animation.
    // Deferred via rAF so the setState calls don't fire synchronously inside the effect body.
    if (prevTargetLevelRef.current === null) {
      prevTargetLevelRef.current = nextLevel;
      ringPercentRef.current = targetPercent;
      const frameId = requestAnimationFrame(() => {
        setRingPercent(targetPercent);
        setRingTransitionMs(0);
      });
      return () => cancelAnimationFrame(frameId);
    }

    const prevLevel = prevTargetLevelRef.current;
    const levelsGained = nextLevel - prevLevel;
    prevTargetLevelRef.current = nextLevel;

    // Cancel any in-flight ring animation and stale level-up cleanup timers so this
    // invocation owns all ring and celebration state going forward.
    ringAnimTimersRef.current.forEach(clearTimeout);
    ringAnimTimersRef.current = [];
    if (levelingUpTimerRef.current) { clearTimeout(levelingUpTimerRef.current); levelingUpTimerRef.current = null; }
    if (crashTimerRef.current) { clearTimeout(crashTimerRef.current); crashTimerRef.current = null; }
    if (uncrashTimerRef.current) { clearTimeout(uncrashTimerRef.current); uncrashTimerRef.current = null; }
    if (unlockToastTimerRef.current) { clearTimeout(unlockToastTimerRef.current); unlockToastTimerRef.current = null; }

    const schedule = (delayMs: number, fn: () => void) => {
      ringAnimTimersRef.current.push(setTimeout(fn, delayMs));
    };

    if (levelsGained <= 0) {
      // Normal XP gain within the same level: smoothly update ring.
      // Deferred via rAF to avoid synchronous setState inside the effect body.
      const transitionMs = Math.max(400, Math.min(1200, Math.abs(targetPercent - (ringPercentRef.current ?? 0)) * 12));
      ringPercentRef.current = targetPercent;
      const frameId = requestAnimationFrame(() => {
        setRingTransitionMs(transitionMs);
        setRingPercent(targetPercent);
      });
      return () => cancelAnimationFrame(frameId);
    }

    // --- Level-up sequence ---
    // For N levels gained the ring cycles N times: fill→100% pause→reset→fill→100%…
    // then a final fill to the actual progress in the new level.
    const startPercent = ringPercentRef.current ?? 0;
    let cursor = 0;

    // Phase 1: fill to 100% from wherever the ring currently sits.
    const fillToDuration = Math.max(300, Math.round((100 - startPercent) * 12));
    schedule(cursor, () => {
      setRingTransitionMs(fillToDuration);
      setRingPercent(100);
      ringPercentRef.current = 100;
    });
    cursor += fillToDuration + 200; // 200ms settling buffer after CSS transition completes

    for (let i = 0; i < levelsGained; i++) {
      const isLastCycle = i === levelsGained - 1;

      // Phase 2: ring is at 100% — fire level-up celebration during the pause.
      schedule(cursor, () => {
        setIsLevelingUp(true);
        setIsBadgeCrashing(false);
        crashTimerRef.current = setTimeout(() => {
          setIsBadgeCrashing(true);
          uncrashTimerRef.current = setTimeout(() => {
            setIsBadgeCrashing(false);
            uncrashTimerRef.current = null;
          }, 600);
          crashTimerRef.current = null;
        }, 850);
      });
      cursor += 700; // hold at 100% for 700ms so the celebration reads clearly

      // Phase 3: instantly reset ring to 0.
      schedule(cursor, () => {
        setRingTransitionMs(0);
        setRingPercent(0);
        ringPercentRef.current = 0;
      });
      // 80ms gap ensures the zero state is committed to the DOM before the next fill begins.
      cursor += 80;

      if (!isLastCycle) {
        // Fill to 100% again for the next level-up cycle.
        const cycleDuration = 1100;
        schedule(cursor, () => {
          setRingTransitionMs(cycleDuration);
          setRingPercent(100);
          ringPercentRef.current = 100;
        });
        cursor += cycleDuration + 200;
      } else {
        // Final fill: animate from 0 to the actual progress percent in the new level.
        const finalDuration = Math.max(500, Math.round(targetPercent * 10));
        schedule(cursor, () => {
          setRingTransitionMs(finalDuration);
          setRingPercent(targetPercent);
          ringPercentRef.current = targetPercent;
        });
        cursor += finalDuration + 300;
        // End level-up state only after the fill is visually complete.
        schedule(cursor, () => {
          setIsLevelingUp(false);
        });

        // Show unlock toast after the celebration ends so it doesn't compete with the animation.
        const newRewards = getNewlyUnlockedRewards(prevLevel, nextLevel);
        if (newRewards.length > 0) {
          schedule(cursor + 400, () => {
            setUnlockedItems(newRewards);
            // Auto-dismiss after 8 seconds if the user doesn't interact.
            unlockToastTimerRef.current = setTimeout(() => {
              setUnlockedItems([]);
              unlockToastTimerRef.current = null;
            }, 8000);
          });
        }
      }
    }

    return () => {
      ringAnimTimersRef.current.forEach(clearTimeout);
      if (crashTimerRef.current) clearTimeout(crashTimerRef.current);
      if (uncrashTimerRef.current) clearTimeout(uncrashTimerRef.current);
      if (unlockToastTimerRef.current) clearTimeout(unlockToastTimerRef.current);
    };
  }, [targetTotalExp]);

  useEffect(
    () => () => {
      if (expAnimationFrameRef.current !== null) {
        cancelAnimationFrame(expAnimationFrameRef.current);
      }
      if (expGainIndicatorTimeoutRef.current !== null) {
        clearTimeout(expGainIndicatorTimeoutRef.current);
      }
      if (unlockToastTimerRef.current !== null) {
        clearTimeout(unlockToastTimerRef.current);
      }
      ringAnimTimersRef.current.forEach(clearTimeout);
    },
    [],
  );

  const dismissUnlockToast = () => {
    setUnlockedItems([]);
    if (unlockToastTimerRef.current) {
      clearTimeout(unlockToastTimerRef.current);
      unlockToastTimerRef.current = null;
    }
  };

  const targetRef = useRef<number | null>(null);

  useEffect(() => {
    // Keep the latest displayed total in a ref so the animation effect can stay target-driven.
    displayedTotalExpRef.current = displayedTotalExp;
  }, [displayedTotalExp]);

  useEffect(() => {
    if (targetTotalExp === null) {
      return;
    }

    const currentDisplayedTotalExp = displayedTotalExpRef.current;
    if (currentDisplayedTotalExp === null) {
      // First boot: set immediately so the starting UI matches the server state.
      // We wrap in rAF to ensure we don't conflict with pending render cycles.
      expAnimationFrameRef.current = requestAnimationFrame(() => {
        displayedTotalExpRef.current = targetTotalExp;
        setDisplayedTotalExp(targetTotalExp);
        targetRef.current = targetTotalExp;
        expAnimationFrameRef.current = null;
      });
      return;
    }

    // If the target hasn't changed, we don't need to restart the animation.
    // This check avoids the "stuttering" effect where animations restart every frame.
    if (targetRef.current === targetTotalExp) {
      return;
    }

    const animationStart = currentDisplayedTotalExp;
    const animationDistance = Math.abs(targetTotalExp - animationStart);
    const previousTargetTotalExp = targetRef.current ?? animationStart;
    const expGained = targetTotalExp - previousTargetTotalExp;
    // Increased duration to make the XP climb more deliberate and satisfying.
    const animationDurationMs = Math.max(400, Math.min(1600, animationDistance * 18));
    const animationDelta = targetTotalExp - animationStart;
    const startedAt = performance.now();

    targetRef.current = targetTotalExp;

    // Show only positive reward deltas so the badge matches practice-room gain feedback.
    if (expGained > 0) {
      setExpGainIndicator(expGained);
      if (expGainIndicatorTimeoutRef.current !== null) {
        clearTimeout(expGainIndicatorTimeoutRef.current);
      }
      expGainIndicatorTimeoutRef.current = setTimeout(() => {
        setExpGainIndicator(null);
        expGainIndicatorTimeoutRef.current = null;
      }, 1400);
    }

    if (expAnimationFrameRef.current !== null) {
      cancelAnimationFrame(expAnimationFrameRef.current);
    }

    // XP text and level use the same animation source so values stay coherent while climbing.
    const step = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / animationDurationMs);
      const easedProgress = easeOutCubic(progress);
      const nextValue = Math.round(animationStart + animationDelta * easedProgress);

      displayedTotalExpRef.current = nextValue;
      setDisplayedTotalExp(nextValue);

      if (progress < 1) {
        expAnimationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      expAnimationFrameRef.current = null;
    };

    expAnimationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (expAnimationFrameRef.current !== null) {
        cancelAnimationFrame(expAnimationFrameRef.current);
      }
    };
  }, [targetTotalExp]); // Decoupled from displayedTotalExp to avoid frame-restarts.

  const expPercent =
    animatedProgress ? Math.min(100, Math.round(animatedProgress.progressPercent)) : 0;

  return (
    <div
      className={`
        ${styles.badge}
        ${isLevelingUp ? styles.badgeLevelUp : ''}
        ${isBadgeCrashing ? styles.badgeCrashShake : ''}
      `}
      aria-label={`${formatName(user)} profile`}
      ref={menuRef}
    >
      <div className={styles.shimmerEffect} aria-hidden="true" />

      {/* Name only — level/progress moved to the ring badge overlay so the stat cluster reads left→right */}
      <div className={styles.meta}>
        <div className={styles.name} title={formatName(user) || ''}>
          {formatName(user) || ''}
        </div>
      </div>

      {/* Level-up celebration overlay — positioning and animation logic unchanged */}
      <AnimatePresence>
        {isLevelingUp && (
          <motion.div
            key={`level-up-anim-${animatedProgress?.level}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.levelUpContainer}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.5, x: '-50%' }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                x: '-50%',
                transition: {
                  delay: 0.4,
                  duration: 0.3,
                  ease: "backOut"
                }
              }}
              exit={{ opacity: 0, scale: 1.1, x: '-50%' }}
              className={styles.levelUpLabel}
            >
              Level Up!
            </motion.div>

            {/* Burst effect synced to the faster drop at T=0.85s */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, x: '-50%', y: '-50%' }}
              animate={{
                scale: 3,
                opacity: [0, 1, 0],
                x: '-50%',
                y: '-50%'
              }}
              transition={{
                delay: 0.85,
                duration: 1.0,
                ease: "easeOut"
              }}
              className={styles.levelValueBurst}
              style={{ animation: 'none', left: '50%', top: '50%' }}
            />

            {/* Particles also synced with the crash hit at T=0.85s */}
            {LEVEL_UP_PARTICLE_OFFSETS.map((params, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: params.x,
                  y: params.y,
                  scale: [0, 1.2, 0],
                }}
                transition={{
                  delay: 0.85 + params.delay,
                  duration: 1.0,
                  ease: "easeOut",
                }}
                className={styles.particle}
                style={{
                  left: '50%',
                  top: '50%',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP gain floats below the badge; wrapper centres it without transform
          conflict since Framer Motion will own the inner element's transform */}
      <div className={styles.expGainFloatingWrapper} aria-hidden="true">
        <AnimatePresence>
          {expGainIndicator ? (
            <motion.div
              key="exp-gain-indicator"
              initial={{ y: -4, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{
                duration: 1,
                ease: [0.175, 0.885, 0.32, 1.275] // Custom back-out for a small "pop"
              }}
              className={styles.expGainFloating}
            >
              +{expGainIndicator} XP
            </motion.div>
          ) : null} {/* Reserve space to prevent layout jump when the indicator appears */}
        </AnimatePresence>
      </div>

      {/* Avatar + SVG ring + level badge overlay — the three are grouped as a single
          cohesive cluster so they animate and clip together naturally */}
      <div className={styles.avatarRingWrapper}>

        {/* Slim SVG arc — replaces the standalone horizontal progress bar.
            Starting at 12 o'clock (rotate -90deg on the SVG) keeps the fill
            reading top→clockwise which feels natural for a progress indicator */}
        {isStudent && animatedProgress ? (
          <svg
            className={styles.progressRing}
            viewBox="0 0 52 52"
            role="progressbar"
            aria-valuenow={expPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="XP progress to next level"
          >
            <circle
              className={styles.progressRingTrack}
              cx="26"
              cy="26"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="4"
            />
            <circle
              className={styles.progressRingFill}
              cx="26"
              cy="26"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              style={{
                strokeDasharray: RING_CIRCUMFERENCE,
                // Use ringPercent (sequenced state) not expPercent (counter-derived) so the ring
                // can fill to 100%, pause, and reset independently of the XP number animation.
                strokeDashoffset: RING_CIRCUMFERENCE * (1 - (ringPercent ?? expPercent) / 100),
                // Duration is varied per animation phase (fill/pause/reset) by the sequencer.
                // ease-out (no overshoot) — the spring curve caused the ring to briefly exceed 100%
                // and visually "pull back", which looks broken on a fill-to-full animation.
                transition: `stroke-dashoffset ${ringTransitionMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), stroke var(--transition-base)`,
                stroke: isLevelingUp ? 'var(--color-accent-light)' : undefined,
              }}
            />
          </svg>
        ) : null}

        <div className={styles.avatarInner}>
          <button
            type="button"
            className={styles.avatarButton}
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="Toggle user menu"
          >
            <img
              src={avatarSrc}
              alt=""
              className={styles.avatar}
              referrerPolicy="no-referrer"
              // Defensive fallback so any bad/expired remote image swaps to our bundled default.
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = defaultAvatar;
              }}
            />
          </button>
        </div>

        {/* Level badge sits at the bottom of the ring — the number flips in 3D when
            the level changes, using the same motion props as before, just in a tighter container */}
        {isStudent && animatedProgress ? (
          <div
            className={`${styles.levelBadge} ${isLevelingUp ? styles.levelBadgeLevelUp : ''}`}
            aria-hidden="true"
          >
            <span className={styles.levelValueWrap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={animatedProgress.level}
                  // Slide up from below + fade in — the badge is only ~20px tall so a 3D spin
                  // just creates a long invisible gap. A fast slide-swap reads more cleanly.
                  initial={{ y: 6, opacity: 0, scale: 0.8 }}
                  animate={{
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    transition: { duration: 0.2, ease: "easeOut" }
                  }}
                  exit={{
                    y: -6,
                    opacity: 0,
                    scale: 0.8,
                    // No color change on exit — the green flash was the old number turning green
                    // while fading out, which looked like a glitch rather than a celebration.
                    transition: { duration: 0.15, ease: "easeIn" }
                  }}
                  className={styles.levelValue}
                  style={{
                    // Keep the number white at all times — at this small size a colour change
                    // just looks like a rendering glitch rather than a celebration cue.
                    // The ring glow, badge background, and overlay particles handle the celebration.
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {animatedProgress.level}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        ) : null}
      </div>

      {isMenuOpen ? (
        <UserBadgeMenu
          avatarSrc={avatarSrc}
          closeMenu={closeMenu}
          expPercent={expPercent}
          onLogout={onLogout}
          studentProgress={isStudent && animatedProgress ? animatedProgress : null}
          user={user}
        />
      ) : null}

      {/* Unlock toast — rendered in a portal-like position (fixed CSS) so it floats above page content. */}
      <AnimatePresence>
        {unlockedItems.length > 0 ? (
          <UnlockToast
            key="unlock-toast"
            items={unlockedItems}
            onDismiss={dismissUnlockToast}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}
