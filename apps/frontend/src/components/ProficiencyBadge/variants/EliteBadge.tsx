// Elite badge skeleton (L30 unlock). Replace the placeholder markup with custom art.
import type { BadgeVariantProps } from '../types';
import styles from './SkeletonBadge.module.css';

export default function EliteBadge({ level, small }: BadgeVariantProps) {
  return (
    <span className={`${styles.skeleton} ${styles.elite} ${small ? styles.skeletonSmall : ''}`}>
      {level}
    </span>
  );
}
