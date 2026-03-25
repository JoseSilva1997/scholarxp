// Explains achievement requirements in one place so locked cards can stay compact without hiding progression rules.
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import styles from '../StudentProfile.module.css';

type AchievementDetail = {
  id: string;
  name: string;
  requirement: string;
  progressDetail: string;
  statusDetail: string;
  earned: boolean;
};

type AchievementDetailModalProps = {
  achievement: AchievementDetail | null;
  onClose: () => void;
};

export default function AchievementDetailModal({
  achievement,
  onClose,
}: AchievementDetailModalProps) {
  useEffect(() => {
    if (!achievement) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [achievement, onClose]);

  if (!achievement) {
    return null;
  }

  const titleId = `${achievement.id}-title`;
  const bodyId = `${achievement.id}-body`;

  return createPortal(
    <div
      className={styles.achievementModalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClick={onClose}
    >
      <div className={styles.achievementModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.achievementModalHeader}>
          <div>
            <h3 id={titleId} className={styles.achievementModalTitle}>
              {achievement.name}
            </h3>
            <span
              className={`${styles.achievementStatusBadge} ${
                achievement.earned
                  ? styles.achievementStatusBadgeEarned
                  : styles.achievementStatusBadgeLocked
              }`}
            >
              {achievement.earned ? 'Completed' : 'Locked'}
            </span>
          </div>
          <button
            type="button"
            className={styles.achievementModalClose}
            onClick={onClose}
            aria-label="Close achievement details"
          >
            Close
          </button>
        </div>

        <div id={bodyId} className={styles.achievementModalBody}>
          <p className={styles.achievementModalRequirement}>{achievement.requirement}</p>
          <div className={styles.achievementModalProgressCard}>
            <span className={styles.achievementModalLabel}>Progress</span>
            <strong className={styles.achievementModalProgressValue}>
              {achievement.progressDetail}
            </strong>
            <span className={styles.achievementModalStatus}>{achievement.statusDetail}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
