import { Link } from 'react-router-dom';
import type { AuthUser } from '../types/auth';
import logo from '../assets/logo.svg';
import UserBadge from './UserBadge';
import { STUDENT_EXP_MAX } from '@scholarxp/constants';
import styles from './Header.module.css';

type HeaderProps = {
  user?: AuthUser | null;
  studentLevel?: number;
  studentExp?: { current: number; max: number };
  onLogout?: () => Promise<void> | void;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
};

export default function Header({
  user,
  studentLevel,
  studentExp,
  onLogout,
  onToggleSidebar,
  showSidebarToggle = false,
}: HeaderProps) {
  const isStudent = user?.globalRole === 'student';
  const derivedLevel = isStudent ? user?.avatar?.level : undefined;
  const derivedExp =
    isStudent && user?.avatar
      ? {
          current: user.avatar.currentExp,
          max: Math.max(user.avatar.currentExp, STUDENT_EXP_MAX),
        }
      : undefined;

  const levelToShow = studentLevel ?? derivedLevel;
  const expToShow = studentExp ?? derivedExp;

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
      </div>
      {user ? (
        <UserBadge user={user} level={levelToShow} exp={expToShow} onLogout={onLogout} />
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
    </header>
  );
}
