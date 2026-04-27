// Profile hero banner: shared by student and tutor roles with role-specific visual additions.
import { useRef, useState, type ChangeEvent } from 'react';
import type { AuthUser } from '@/shared/types/auth';
import {
  PROFILE_PICTURE_ALLOWED_MIME_TYPES,
  PROFILE_PICTURE_MAX_BYTES,
  type AccountProgress,
  type ProfilePictureMimeType,
} from '@scholarxp/api-contracts';
import { canAccess, features } from '@scholarxp/permissions';
import { FaFire } from 'react-icons/fa6';
import defaultAvatar from '@/assets/default-profile-pic.png';
import { useAuth } from '@/context/AuthContext';
import { removeProfilePicture, uploadProfilePicture } from '@/Account/api/users';
import { cropImageToSquare } from '@/utils/cropImageToSquare';
import { logError } from '@/utils/logger';
import styles from '@/Account/Profile/components/HeroCard.module.css';

type HeroCardProps = {
  user: AuthUser;
  accountProgress?: AccountProgress | null;
  masterQuestStreak?: number;
  isEditingProfile: boolean;
  onEditProfile: () => void;
};

const ACCEPT_ATTR = PROFILE_PICTURE_ALLOWED_MIME_TYPES.join(',');

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
  const { setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);

  const canEditPicture = canAccess(features.users.updateOwnProfilePicture, {
    role: user.globalRole,
  });

  const avatarSrc =
    user.profilePictureUrl && user.profilePictureUrl.startsWith('http')
      ? user.profilePictureUrl
      : defaultAvatar;
  const hasCustomPicture = avatarSrc !== defaultAvatar;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    // Always reset the input value so re-selecting the same file still fires onChange.
    input.value = '';
    if (!file) return;

    setPictureError(null);
    if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.includes(file.type as ProfilePictureMimeType)) {
      setPictureError('Image must be PNG, JPEG, or WebP.');
      return;
    }
    if (file.size > PROFILE_PICTURE_MAX_BYTES) {
      setPictureError('Image must be 5 MB or smaller.');
      return;
    }

    setIsMutating(true);
    try {
      const cropped = await cropImageToSquare(file);
      const refreshed = await uploadProfilePicture(user.id, cropped);
      setUser(refreshed);
    } catch (err) {
      logError(err, { source: 'HeroCard.uploadProfilePicture' });
      setPictureError('Failed to update profile picture. Please try again.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemove() {
    setPictureError(null);
    setIsMutating(true);
    try {
      const refreshed = await removeProfilePicture(user.id);
      setUser(refreshed);
    } catch (err) {
      logError(err, { source: 'HeroCard.removeProfilePicture' });
      setPictureError('Failed to remove profile picture. Please try again.');
    } finally {
      setIsMutating(false);
    }
  }

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

        {isEditingProfile && canEditPicture ? (
          <div className={styles.pictureActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              onChange={handleFileChange}
              hidden
              data-testid="profile-picture-input"
            />
            <button
              type="button"
              className={styles.pictureButton}
              onClick={() => fileInputRef.current?.click()}
              disabled={isMutating}
            >
              {isMutating ? 'Working...' : 'Upload'}
            </button>
            {hasCustomPicture ? (
              <button
                type="button"
                className={styles.pictureButton}
                onClick={handleRemove}
                disabled={isMutating}
              >
                Remove
              </button>
            ) : null}
            {pictureError ? (
              <p className={styles.pictureError} role="alert">{pictureError}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.info}>
        <h1 className={styles.name}>{name}</h1>

        <div className={styles.metaRow}>
          <span className={`${styles.rolePill} ${isStudent ? styles.rolePillStudent : styles.rolePillTutor}`}>
            {isStudent ? 'Student' : 'Teacher'}
          </span>

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
