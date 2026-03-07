/**
 * ProficiencyLevelBadge Component
 * 
 * Renders a decorative hexagon badge displaying a student's proficiency level
 * with a multi-layered design featuring gold and purple colors. The badge includes
 * an outer gold border, purple middle layer, and inner gold hexagon with the level number.
 */

import styles from './ProficiencyLevelBadge.module.css';

interface ProficiencyLevelBadgeProps {
  /** The proficiency level number to display (e.g., 1-100) */
  level: number;
}

/**
 * ProficiencyLevelBadge: Displays the student's proficiency level in an ornate hexagonal badge.
 * Uses CSS variables from theme.css for consistent theming.
 */
export function ProficiencyLevelBadge({ level }: ProficiencyLevelBadgeProps) {
  return (
    <div className={styles['badge-glow-wrapper']}>
        {/* Layer 1: Overall Deep Gold Outer Border */}
        <div className={styles['badge-outer']}>
          {/* Layer 2: Thick Purple Layer */}
          <div className={styles['badge-middle']}>
            {/* Wrapper to allow the inner hexagon to cast a shadow over the purple */}
            <div className={styles['badge-inner-shadow-wrapper']}>
              {/* Layer 3: Inner Golden Hexagon */}
              <div className={styles['badge-inner']}>
                <span className={styles['badge-number']}>{level}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
