// Profile hero banner: shared by student and tutor roles with role-specific visual additions.
import type { AuthUser } from '@/types/auth';
import type { AccountProgress } from '@scholarxp/api-contracts';
import { FaFire } from 'react-icons/fa6';
import defaultAvatar from '@/assets/default-profile-pic.png';
import styles from './HeroCard.module.css';

type HeroCardProps = {
  user: AuthUser;
  accountProgress?: AccountProgress | null;
  masterQuestStreak?: number;
  isEditingProfile: boolean;
  onEditProfile: () => void;
};

function formatName(user: AuthUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

// SVG ring dimensions for the student level ring — sized to wrap the profile picture with visual padding.
const RING_SIZE = 120;
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_CENTER = RING_SIZE / 2;

export default function HeroCard({
  user,
  accountProgress,
  masterQuestStreak,
  isEditingProfile,
  onEditProfile,
}: HeroCardProps) {
  const isStudent = user.globalRole === 'student';
  const name = formatName(user) || 'User';

  const avatarSrc =
    user.profilePictureUrl && user.profilePictureUrl.startsWith('http')
      ? user.profilePictureUrl
      : defaultAvatar;

  const progressPercent = accountProgress
    ? Math.min(100, Math.round(accountProgress.progressPercent))
    : 0;

  return (
    <div className={styles.hero}>
      <div className={styles.avatarSection}>
        <div className={styles.avatarContainer}>
          {isStudent && accountProgress ? (
            <svg
              className={styles.levelRing}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="XP progress to next level"
            >
              <circle
                className={styles.ringTrack}
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                strokeWidth="4"
              />
              <circle
                className={styles.ringFill}
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                style={{
                  strokeDasharray: RING_CIRCUMFERENCE,
                  strokeDashoffset: RING_CIRCUMFERENCE * (1 - progressPercent / 100),
                }}
              />
            </svg>
          ) : null}

          <img
            src={avatarSrc}
            alt={`${name} profile picture`}
            className={`${styles.avatar} ${isStudent ? styles.avatarStudent : styles.avatarTutor}`}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = defaultAvatar;
            }}
          />

          {isStudent && accountProgress ? (
            <div className={styles.levelBadge} aria-label={`Level ${accountProgress.level}`}>
              {accountProgress.level}
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.info}>
        <h1 className={styles.name}>{name}</h1>

        <div className={styles.metaRow}>
          <span className={`${styles.rolePill} ${isStudent ? styles.rolePillStudent : styles.rolePillTutor}`}>
            {isStudent ? 'Student' : 'Teacher'}
          </span>

          {user.hasInstitutionMembership ? (
            <span className={styles.institutionLabel}>Institution linked</span>
          ) : null}

          {user.isVerified ? (
            <span className={styles.verifiedBadge} title="Email verified">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </span>
          ) : null}
        </div>

        {isStudent && typeof masterQuestStreak === 'number' ? (
          <div className={styles.streakRow}>
            <FaFire className={styles.streakIcon} aria-hidden="true" />
            <span className={styles.streakCount}>{masterQuestStreak}</span>
            <span className={styles.streakLabel}>day streak</span>
          </div>
        ) : null}

        <button
          type="button"
          className={styles.editButton}
          onClick={onEditProfile}
        >
          {isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}
        </button>
      </div>
    </div>
  );
}
