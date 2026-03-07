import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { getProgressWithinLevel } from '@scholarxp/progression';
import type { AuthUser } from '../types/auth';
import defaultAvatar from '../assets/default-profile-pic.png';
import styles from './UserBadge.module.css';

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

export default function UserBadge({ user, onLogout }: UserBadgeProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [displayedTotalExp, setDisplayedTotalExp] = useState<number | null>(null);
  const [expGainIndicator, setExpGainIndicator] = useState<number | null>(null);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [isBadgeCrashing, setIsBadgeCrashing] = useState(false);
  const prevLevelRef = useRef<number | null>(null);
  const levelingUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uncrashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelingUpRafRef = useRef<number | null>(null);
  const expAnimationFrameRef = useRef<number | null>(null);
  const expGainIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedTotalExpRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

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
    const currentLevel = animatedProgress?.level;
    if (currentLevel !== undefined) {
      if (prevLevelRef.current !== null && currentLevel > prevLevelRef.current) {
        // Clear any previous queued level-up check to avoid duplicate animations.
        if (levelingUpRafRef.current) cancelAnimationFrame(levelingUpRafRef.current);

        // Deferring state changes to a new frame to avoid synchronous setState inside an effect.
        levelingUpRafRef.current = requestAnimationFrame(() => {
          setIsLevelingUp(true);

          if (levelingUpTimerRef.current) clearTimeout(levelingUpTimerRef.current);
          if (crashTimerRef.current) clearTimeout(crashTimerRef.current);
          if (uncrashTimerRef.current) clearTimeout(uncrashTimerRef.current);
          setIsBadgeCrashing(false);

          crashTimerRef.current = setTimeout(() => {
            setIsBadgeCrashing(true);
            uncrashTimerRef.current = setTimeout(() => {
              setIsBadgeCrashing(false);
              uncrashTimerRef.current = null;
            }, 600);
            crashTimerRef.current = null;
          }, 850); // Matches the new faster sequence drop point

          levelingUpTimerRef.current = setTimeout(() => {
            setIsLevelingUp(false);
            levelingUpTimerRef.current = null;
          }, 2400); // Resets sooner now that sequence is snappy
          
          levelingUpRafRef.current = null;
        });
      }
      prevLevelRef.current = currentLevel;
    }
    return () => {
      if (levelingUpRafRef.current) cancelAnimationFrame(levelingUpRafRef.current);
      if (levelingUpTimerRef.current) clearTimeout(levelingUpTimerRef.current);
      if (crashTimerRef.current) clearTimeout(crashTimerRef.current);
      if (uncrashTimerRef.current) clearTimeout(uncrashTimerRef.current);
    };
  }, [animatedProgress?.level]); // Ref is stable, only dependency is the derived level.

  useEffect(
    () => () => {
      if (expAnimationFrameRef.current !== null) {
        cancelAnimationFrame(expAnimationFrameRef.current);
      }
      if (expGainIndicatorTimeoutRef.current !== null) {
        clearTimeout(expGainIndicatorTimeoutRef.current);
      }
    },
    [],
  );

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
      <div className={styles.meta}>
        <div className={styles.name} title={formatName(user) || ''}>
          {formatName(user) || ''}
        </div>
        {isStudent && animatedProgress ? (
          <div className={styles.progress}>
            <div className={styles.barRow}>
              <span className={styles.level}>
                Level{' '}
                <span className={styles.levelValueWrap}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={animatedProgress.level}
                      initial={{ y: -14, opacity: 0, rotateY: 1080, scale: 1.1 }}
                      animate={{ 
                        y: 0, 
                        opacity: 1, 
                        rotateY: 0,
                        scale: 1,
                        transition: {
                          y: { 
                            type: 'tween', 
                            duration: 0.12, 
                            ease: "easeIn", 
                            delay: 0.8 // Hold during transformation spin, then drop
                          },
                          rotateY: { duration: 0.5, delay: 0.3, ease: "easeOut" }, // Spin back faster
                          opacity: { duration: 0.1, delay: 0.3 },
                          scale: { duration: 0.15, delay: 0.3 },
                        }
                      }}
                      exit={{ 
                        y: -14, // No array here, starts from 0 (if reached) and goes to -14
                        rotateY: 1080, 
                        opacity: 0,
                        scale: 1.1,
                        color: 'var(--color-secondary)',
                        transition: {
                          duration: 0.3,
                          y: { ease: "easeOut" },
                          rotateY: { ease: "easeInOut" },
                          opacity: { duration: 0.25 },
                          scale: { ease: "easeOut" }
                        }
                      }}
                      className={styles.levelValue}
                      style={{
                        color: isLevelingUp ? 'var(--color-secondary)' : 'var(--color-accent-light)',
                        textShadow: isLevelingUp 
                          ? '0 0 10px var(--color-secondary-soft), 0 0 20px var(--color-secondary-soft)' 
                          : 'none',
                        fontWeight: isLevelingUp ? 900 : 800,
                        transformStyle: 'preserve-3d',
                        zIndex: isLevelingUp ? 11 : 1,
                      }}
                    >
                      {animatedProgress.level}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
              <div className={styles.trackContainer}>
                <div className={styles.expValueContainer}>
                  <span className={styles.expLabel}>{animatedProgress.currentLevelExp} xp</span>
                  <AnimatePresence>
                    {expGainIndicator ? (
                      <motion.span
                        key="exp-gain-indicator"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className={styles.expGain}
                      >
                        +{expGainIndicator}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </div>
                <div className={styles.barTrack} role="progressbar" aria-valuenow={expPercent} aria-valuemin={0} aria-valuemax={100}>
                  <div className={styles.barFill} style={{ width: `${expPercent}%` }} />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

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
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          // Defensive fallback so any bad/expired remote image swaps to our bundled default.
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = defaultAvatar;
          }}
        />
      </button>
      {isMenuOpen ? (
        <div className={styles.menu} role="menu">
          {/* Panel Header with Profile Preview */}
          <div className={styles.menuHeader}>
            <img
              src={avatarSrc}
              alt=""
              className={styles.menuHeaderAvatar}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = defaultAvatar;
              }}
            />
            <div className={styles.menuHeaderInfo}>
              <div className={styles.menuHeaderName}>{formatName(user) || 'User'}</div>
              <div className={styles.menuHeaderRole}>
                {user.globalRole === 'student' ? 'Student' : 'Teacher'}
              </div>
            </div>
          </div>

          {/* Student Progress (Mobile Fallback) */}
          {user.globalRole === 'student' && animatedProgress ? (
            <div className={styles.menuProgress}>
              <div className={styles.menuProgressHeader}>
                <span className={styles.menuLevel}>Level {animatedProgress.level}</span>
                <span className={styles.menuExp}>
                  {animatedProgress.currentLevelExp} / {animatedProgress.nextLevelExpRequired} XP
                </span>
              </div>
              <div className={styles.menuBarTrack}>
                <div className={styles.menuBarFill} style={{ width: `${expPercent}%` }} />
              </div>
            </div>
          ) : null}

          {/* Panel Content */}
          <div className={styles.menuContent}>
            {/* Main Actions */}
            <div className={styles.menuSection}>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => {
                  navigate('/main');
                  closeMenu();
                }}
              >
                <svg className={styles.menuItemIcon} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                </svg>
                My content
              </button>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => {
                  navigate('/main/profile');
                  closeMenu();
                }}
              >
                <svg className={styles.menuItemIcon} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                Account settings
              </button>
            </div>

            {/* Logout Section */}
            <div className={styles.menuFooter}>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={async () => {
                  closeMenu();
                  if (onLogout) await onLogout();
                }}
              >
                <svg className={styles.menuItemIcon} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}
