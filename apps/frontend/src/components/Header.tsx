import { Link } from 'react-router-dom';
import type { AuthUser } from '../types/auth';
import logo from '../assets/logo.svg';
import UserBadge from './UserBadge';
import { STUDENT_EXP_MAX } from '../constants/progression';
import styles from './Header.module.css';

type HeaderProps = {
  user?: AuthUser | null;
  studentLevel?: number;
  studentExp?: { current: number; max: number };
};

export default function Header({ user, studentLevel, studentExp }: HeaderProps) {
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
    <header className={styles.header}>
      <Link to="/" className={styles.brand} aria-label="Go to landing page">
        <img src={logo} alt="ScholarXP logo" className={styles.logo} />
        <span className={styles.wordmark}>ScholarXP</span>
      </Link>

      <nav className={styles.nav} aria-label="Primary navigation">
        {/* Navigation links will be added here as pages are introduced. */}
      </nav>

      {user ? (
        <UserBadge user={user} level={levelToShow} exp={expToShow} />
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
