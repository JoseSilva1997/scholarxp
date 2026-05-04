// Default L1 proficiency badge — a clean number with no ornamentation. Replace or style as needed.
import type { BadgeVariantProps } from '@/Rewards/components/ProficiencyBadge/types';
import styles from '@/Rewards/components/ProficiencyBadge/variants/PlainBadge.module.css';

// Renders the baseline badge variant used before any proficiency badge cosmetic has been unlocked.
export default function PlainBadge({ level, small }: BadgeVariantProps) {
  return (
    <span className={`${styles.plain} ${small ? styles.plainSmall : ''}`}>
      {level}
    </span>
  );
}
