import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AuthUser } from '../types/auth';
import logo from '../assets/logo.svg';
import UserBadge from './UserBadge';
import ThemeToggle from './ThemeToggle';
import { useTodayQuestListQuery } from '../hooks/queries/useQuestsQueries';
import { BsTrophyFill } from 'react-icons/bs';
import TodayQuestPopover from './TodayQuestPopover';
import styles from './Header.module.css';

type TodayChipAcknowledgement = {
  userId: number;
  dayKey: string;
  completedCount: number;
};

const buildTodayChipAcknowledgementStorageKey = (userId: number) =>
  `today-quest-chip-acknowledgement:${userId}`;

const readTodayChipAcknowledgement = (
  userId?: number,
): TodayChipAcknowledgement | null => {
  if (typeof window === 'undefined' || !userId) {
    return null;
  }

  const storedValue = window.sessionStorage.getItem(
    buildTodayChipAcknowledgementStorageKey(userId),
  );

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<TodayChipAcknowledgement>;
    if (
      parsedValue.userId !== userId ||
      typeof parsedValue.dayKey !== 'string' ||
      typeof parsedValue.completedCount !== 'number'
    ) {
      return null;
    }

    return {
      userId: parsedValue.userId,
      dayKey: parsedValue.dayKey,
      completedCount: parsedValue.completedCount,
    };
  } catch {
    return null;
  }
};

type HeaderProps = {
  user?: AuthUser | null;
  onLogout?: () => Promise<void> | void;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
};

export default function Header({
  user,
  onLogout,
  onToggleSidebar,
  showSidebarToggle = false,
}: HeaderProps) {
  const [isTodayPopoverOpen, setIsTodayPopoverOpen] = useState(false);
  const [todayChipAcknowledgement, setTodayChipAcknowledgement] =
    useState<TodayChipAcknowledgement | null>(() =>
      readTodayChipAcknowledgement(user?.id),
    );
  const todayChipWrapperRef = useRef<HTMLDivElement | null>(null);
  const isStudent = user?.globalRole === 'student';
  const todayQuestListQuery = useTodayQuestListQuery(
    Boolean(user && isStudent),
    user?.id,
  );
  const todayQuestList = todayQuestListQuery.data;
  const todayQuestLabel = todayQuestList
    ? `${todayQuestList.completed}/${todayQuestList.max}`
    : '--/3';
  const effectiveTodayChipAcknowledgement =
    todayChipAcknowledgement?.userId === user?.id
      ? todayChipAcknowledgement
      : readTodayChipAcknowledgement(user?.id);
  const todayQuestDayKey =
    todayQuestList?.quests[0]?.questDateUtc ??
    todayQuestList?.masterQuest?.questDateUtc ??
    new Date().toISOString().slice(0, 10);
  const completedQuestCount = todayQuestList?.completed ?? 0;
  // The glow is an attention cue for newly completed quests, so dismissing it should only last until the count increases again.
  const shouldGlowTodayChip =
    completedQuestCount > 0 &&
    (effectiveTodayChipAcknowledgement?.dayKey !== todayQuestDayKey ||
      completedQuestCount > effectiveTodayChipAcknowledgement.completedCount);

  useEffect(() => {
    if (!isTodayPopoverOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) return;
      if (todayChipWrapperRef.current?.contains(targetNode)) return;
      setIsTodayPopoverOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTodayPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isTodayPopoverOpen]);

  return (
    <header className={`${styles.header} ${!user ? styles.headerLoggedOut : ''}`}>
      <div className={styles.brandWrapper}>
        {showSidebarToggle && (
          <button
            type="button"
            className={styles.toggleButton}
            onClick={onToggleSidebar}
            aria-label="Toggle navigation panel"
          >
            <span className={styles.toggleIcon} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        )}
        <Link to="/" className={styles.brand} aria-label="Go to landing page">
          <img src={logo} alt="ScholarXP logo" className={styles.logo} />
          <span className={styles.wordmark}>ScholarXP</span>
        </Link>
        {isStudent ? (
          <div
            className={`${styles.todayChipWrapper} ${
              shouldGlowTodayChip ? styles.todayChipWrapperGlow : ''
            }`.trim()}
            ref={todayChipWrapperRef}
            data-testid="today-chip-wrapper"
          >
            <button
              type="button"
              className={`${styles.todayChip} ${isTodayPopoverOpen ? styles.todayChipActive : ''}`}
              aria-label={`Today's quests ${todayQuestLabel}`}
              aria-expanded={isTodayPopoverOpen}
              aria-controls="today-quest-popover"
              onClick={() => {
                setIsTodayPopoverOpen((isOpen) => !isOpen);
                if (!user?.id) {
                  return;
                }

                const acknowledgement = {
                  userId: user.id,
                  dayKey: todayQuestDayKey,
                  completedCount: completedQuestCount,
                };

                // Persist the acknowledgement across refreshes so the chip only
                // glows after new quest completions, not because the page reloaded.
                window.sessionStorage.setItem(
                  buildTodayChipAcknowledgementStorageKey(user.id),
                  JSON.stringify(acknowledgement),
                );
                setTodayChipAcknowledgement(acknowledgement);
              }}
            >
              <BsTrophyFill className={styles.todayChipIcon} />
              <div className={styles.todayChipContent}>
                <span className={styles.todayChipLabel}>Quests</span>
                <span className={styles.todayChipValue}>{todayQuestLabel}</span>
              </div>
            </button>
            {isTodayPopoverOpen ? (
              <TodayQuestPopover
                id="today-quest-popover"
                quests={todayQuestList?.quests ?? []}
                masterQuest={todayQuestList?.masterQuest ?? null}
                completed={todayQuestList?.completed ?? 0}
                max={todayQuestList?.max ?? 3}
                isLoading={todayQuestListQuery.isPending}
                onNavigateToHistory={() => setIsTodayPopoverOpen(false)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={styles.headerRight}>
        <ThemeToggle />
        {user ? (
          <UserBadge user={user} onLogout={onLogout} />
        ) : (
          <div className={styles.actions}>
            <Link className={`${styles.btn} ${styles.btnGhost}`} to="/login">
              Login
            </Link>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} to="/register">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
