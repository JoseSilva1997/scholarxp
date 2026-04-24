// RS-style XP card for displaying individual XP categories with progress bars.
import React from 'react';
import styles from '@/Authoring/SingleModule/XpStatCard.module.css';

interface XpStatCardProps {
  label: string;
  current: number;
  max: number;
  title?: string;
  colorClass?: string;
  icon?: React.ReactNode;
  variant?: 'rs' | 'classic';
}

export default function XpStatCard({
  label,
  current,
  max,
  title,
  colorClass = '',
  icon,
  variant = 'rs',
}: XpStatCardProps) {
  const percent = Math.min(100, Math.max(0, (current / max) * 100));
  const mappedColorClass = colorClass ? styles[colorClass] || colorClass : '';

  if (variant === 'classic') {
    return (
      <div className={`${styles.classicRow} ${mappedColorClass}`.trim()} title={title}>
        <div className={styles.classicLayout}>
          <div className={styles.classicInfo}>
            <span className={styles.classicIcon}>{icon}</span>
            <span className={styles.classicLabel}>{label}</span>
          </div>
          <div className={styles.classicBarWrapper}>
            <div className={styles.classicBarTrack}>
            <div 
                className={styles.classicBarFill} 
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className={styles.classicValues}>{current} / {max}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${mappedColorClass}`.trim()} title={title}>
      <div className={styles.iconSection}>
        {icon && <div className={styles.iconWrapper}>{icon}</div>}
        <span className={styles.nameLabel}>{label}</span>
      </div>
      <div className={styles.contentSection}>
        <div className={styles.topRow}>
          <span className={styles.currentVal}>{current}</span>
        </div>
        <div className={styles.progressRow}>
          <div className={styles.barTrack}>
            <div 
              className={styles.barFill} 
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div className={styles.bottomRow}>
          <span className={styles.maxVal}>{max}</span>
        </div>
      </div>
    </div>
  );
}
