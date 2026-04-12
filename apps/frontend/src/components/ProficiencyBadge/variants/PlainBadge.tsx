// Default L1 proficiency badge — a clean number with no ornamentation. Replace or style as needed.
import type { BadgeVariantProps } from '../types';
import styles from './PlainBadge.module.css';

export default function PlainBadge({ level, small }: BadgeVariantProps) {
  return (
    <span className={`${styles.plain} ${small ? styles.plainSmall : ''}`}>
      {level}
    </span>
  );
}
