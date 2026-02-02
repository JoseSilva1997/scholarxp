import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../types/auth';
import defaultAvatar from '../assets/default-profile-pic.png';
import { STUDENT_EXP_MAX } from '@scholarxp/constants';
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
          {/* Panel Header with Profile Preview */}
          <div className={styles.menuHeader}>
            <img
              src={avatarSrc}
              alt=""
              className={styles.menuHeaderAvatar}
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
