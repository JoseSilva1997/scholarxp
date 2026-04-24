// Legend crest badge (L80 unlock): gold/bronze crest with orange (legendary) core and flanking heraldic wings.
import type { BadgeVariantProps } from '@/Rewards/components/ProficiencyBadge/types';
import styles from '@/Rewards/components/ProficiencyBadge/variants/LegendBadge.module.css';

export default function LegendBadge({ level, small }: BadgeVariantProps) {
  return (
    <div className={styles.wrapper}>
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
    </div>
  );
}
