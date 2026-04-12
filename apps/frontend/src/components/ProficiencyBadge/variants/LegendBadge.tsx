// Legend badge skeleton (L80 unlock). Replace the placeholder markup with custom art.
import type { BadgeVariantProps } from '../types';
import styles from './SkeletonBadge.module.css';

export default function LegendBadge({ level, small }: BadgeVariantProps) {
  return (
    <span className={`${styles.skeleton} ${styles.legend} ${small ? styles.skeletonSmall : ''}`}>
      {level}
    </span>
  );
}
