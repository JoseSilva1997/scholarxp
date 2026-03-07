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
          <div className={styles.todayChipWrapper} ref={todayChipWrapperRef}>
            <button
              type="button"
              className={`${styles.todayChip} ${isTodayPopoverOpen ? styles.todayChipActive : ''}`}
              aria-label={`Today's quests ${todayQuestLabel}`}
              aria-expanded={isTodayPopoverOpen}
              aria-controls="today-quest-popover"
              onClick={() => setIsTodayPopoverOpen((isOpen) => !isOpen)}
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
