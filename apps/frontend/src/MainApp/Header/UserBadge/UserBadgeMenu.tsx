// Renders user badge dropdown profile summary and menu actions.
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '@/shared/types/auth';
import defaultAvatar from '@/assets/default-profile-pic.png';
import styles from '@/MainApp/Header/UserBadge/UserBadge.module.css';

type StudentProgress = {
  currentLevelExp: number;
  level: number;
  nextLevelExpRequired: number;
};

type UserBadgeMenuProps = {
  avatarSrc: string;
  closeMenu: () => void;
  expPercent: number;
  onLogout?: () => Promise<void> | void;
  studentProgress: StudentProgress | null;
  user: AuthUser;
};

function formatRole(role: AuthUser['globalRole']) {
  return role === 'student' ? 'Student' : 'Teacher';
}

function formatName(user: AuthUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

export default function UserBadgeMenu({
  avatarSrc,
  closeMenu,
  expPercent,
  onLogout,
  studentProgress,
  user,
}: UserBadgeMenuProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.menu} role="menu">
      <div className={styles.menuHeader}>
        <div className={styles.menuHeaderProfileSide}>
          <img
            src={avatarSrc}
            alt=""
            className={styles.menuHeaderAvatar}
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = defaultAvatar;
            }}
          />
          {studentProgress ? (
            <div className={styles.menuHeaderLevelBadge}>{studentProgress.level}</div>
          ) : null}
        </div>
        <div className={styles.menuHeaderInfo}>
          <div className={styles.menuHeaderName}>{formatName(user) || 'User'}</div>
          <div className={styles.menuHeaderRole}>{formatRole(user.globalRole)}</div>

          {studentProgress ? (
            <div className={styles.menuProgressIntegrated}>
              <div className={styles.menuExpLabel}>
                {studentProgress.currentLevelExp} / {studentProgress.nextLevelExpRequired} XP
              </div>
              <div className={styles.menuBarTrack}>
                <div className={styles.menuBarFill} style={{ width: `${expPercent}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.menuContent}>
        <div className={styles.menuSection}>
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
  );
}
