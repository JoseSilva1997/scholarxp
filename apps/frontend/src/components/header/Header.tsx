import { Link } from 'react-router-dom';
import type { AuthUser } from '@/types/auth';
import logo from '@/assets/logo.svg';
import ThemeToggle from '@/components/ThemeToggle';
import UserBadge from './UserBadge';
import TodayQuestChip from './TodayQuestChip';
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
  const isStudent = user?.globalRole === 'student';

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
        {/* Student quest status lives in its own component so Header stays a presentational shell. */}
        {isStudent && user ? <TodayQuestChip userId={user.id} /> : null}
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
