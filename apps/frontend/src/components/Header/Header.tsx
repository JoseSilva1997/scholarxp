import { Link } from 'react-router-dom';
import type { AuthUser } from '@/types/auth';
import logo from '@/assets/logo.svg';
import ThemeToggle from '@/components/Header/ThemeToggle';
import StudentQuestHeaderStatus from './StudentQuestHeaderStatus';
import UserBadge from './UserBadge';
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
      {/* LEFT: hamburger toggle + brand logo anchored to the edge */}
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
      </div>

      {/* CENTRE: student progress stats, isolated so the outer shell stays layout-only */}
      {isStudent && user ? (
        <div className={styles.headerCenter}>
          <StudentQuestHeaderStatus userId={user.id} />
        </div>
      ) : null}

      {/* RIGHT: theme toggle + cohesive profile cluster */}
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
