// Master badge skeleton (L55 unlock). Replace the placeholder markup with custom art.
import type { BadgeVariantProps } from '../types';
import styles from './SkeletonBadge.module.css';

export default function MasterBadge({ level, small }: BadgeVariantProps) {
  return (
    <span className={`${styles.skeleton} ${styles.master} ${small ? styles.skeletonSmall : ''}`}>
      {level}
    </span>
  );
}
