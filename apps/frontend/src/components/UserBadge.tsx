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
};

function formatName(user: AuthUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

export default function UserBadge({ user, level, exp }: UserBadgeProps) {
  const avatarSrc =
    user.profilePictureUrl && user.profilePictureUrl.startsWith('http')
      ? user.profilePictureUrl
      : defaultAvatar;

  const isStudent = user.globalRole === 'student';
  const expMax = exp?.max && exp.max > 0 ? exp.max : STUDENT_EXP_MAX;
  const expPercent =
    exp && expMax > 0 ? Math.min(100, Math.round((exp.current / expMax) * 100)) : 0;

  return (
    <div className={styles.badge} aria-label={`${formatName(user)} profile`}>
      <div className={styles.meta}>
        <div className={styles.name} title={formatName(user) || 'User'}>
          {formatName(user) || 'User'}
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
      <img src={avatarSrc} alt="" className={styles.avatar} />
    </div>
  );
}
