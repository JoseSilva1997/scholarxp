// Ornate hex badge (L5 unlock): gold outer border, bronze middle, inner gold hexagon with level number.
import type { BadgeVariantProps } from '@/Rewards/components/ProficiencyBadge/types';
import styles from '@/Rewards/components/ProficiencyBadge/variants/OrnateBadge.module.css';

export default function OrnateBadge({ level, small }: BadgeVariantProps) {
  return (
    <div className={styles.glowWrapper}>
      <div className={`${styles.outer} ${small ? styles.outerSmall : ''}`}>
        <div className={`${styles.middle} ${small ? styles.middleSmall : ''}`}>
          <div className={styles.innerShadow}>
            <div className={`${styles.inner} ${small ? styles.innerSmall : ''}`}>
              <span className={`${styles.number} ${small ? styles.numberSmall : ''}`}>
                {level}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
