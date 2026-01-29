import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../types/auth';
import defaultAvatar from '../assets/default-profile-pic.png';
import { STUDENT_EXP_MAX } from '../constants/progression';
import expIcon from '../assets/exp_icon.svg';
import styles from './UserBadge.module.css';

type UserBadgeProps = {
  user: AuthUser;
  level?: number;
  exp?: {
    current: number;
    max: number;
  };
  onLogout?: () => Promise<void> | void;
};

function formatName(user: AuthUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

export default function UserBadge({ user, level, exp, onLogout }: UserBadgeProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const expMax = exp?.max && exp.max > 0 ? exp.max : STUDENT_EXP_MAX;
  const expPercent =
    exp && expMax > 0 ? Math.min(100, Math.round((exp.current / expMax) * 100)) : 0;

  return (
    <div className={styles.badge} aria-label={`${formatName(user)} profile`} ref={menuRef}>
      <div className={styles.meta}>
        <div className={styles.name} title={formatName(user) || ''}>
          {formatName(user) || ''}
        </div>
        {isStudent && level !== undefined && exp ? (
          <div className={styles.progress}>
            <span className={styles.level}>
              <img src={expIcon} alt="" aria-hidden="true" className={styles.levelIcon} />
              Level {level}
            </span>
            <div className={styles.barTrack} role="progressbar" aria-valuenow={expPercent} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.barFill} style={{ width: `${expPercent}%` }} />
            </div>
            <span className={styles.expLabel}>{exp.current} xp</span>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={styles.avatarButton}
        onClick={toggleMenu}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
      >
        <img
          src={avatarSrc}
          alt=""
          className={styles.avatar}
          // Defensive fallback so any bad/expired remote image swaps to our bundled default.
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = defaultAvatar;
          }}
        />
      </button>
      {isMenuOpen ? (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              // Navigating via router keeps SPA context and closes the menu for consistent UX.
              navigate('/main');
              closeMenu();
            }}
          >
            My content
          </button>
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              // Profile page is the natural destination for account settings today.
              navigate('/main/profile');
              closeMenu();
            }}
          >
            Account settings
          </button>
          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={async () => {
              closeMenu();
              if (onLogout) await onLogout();
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
