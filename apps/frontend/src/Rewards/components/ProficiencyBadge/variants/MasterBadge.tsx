// Master crest badge (L55 unlock): gold/bronze borders, purple core shaped like an ornate crest.
import type { BadgeVariantProps } from '@/Rewards/components/ProficiencyBadge/types';
import styles from '@/Rewards/components/ProficiencyBadge/variants/MasterBadge.module.css';

export default function MasterBadge({ level, small }: BadgeVariantProps) {
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
