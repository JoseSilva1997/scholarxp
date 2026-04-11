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
  /** Renders a smaller variant — used in dense contexts like tables and stat grids */
  small?: boolean;
}

/**
 * ProficiencyLevelBadge: Displays the student's proficiency level in an ornate hexagonal badge.
 * Uses CSS variables from theme.css for consistent theming.
 */
export function ProficiencyLevelBadge({ level, small }: ProficiencyLevelBadgeProps) {
  return (
    <div className={styles['badge-glow-wrapper']}>
        {/* Layer 1: Overall Deep Gold Outer Border */}
        <div className={`${styles['badge-outer']} ${small ? styles['badge-outer--small'] : ''}`}>
          {/* Layer 2: Thick Purple Layer */}
          <div className={`${styles['badge-middle']} ${small ? styles['badge-middle--small'] : ''}`}>
            {/* Wrapper to allow the inner hexagon to cast a shadow over the purple */}
            <div className={styles['badge-inner-shadow-wrapper']}>
              {/* Layer 3: Inner Golden Hexagon */}
              <div className={`${styles['badge-inner']} ${small ? styles['badge-inner--small'] : ''}`}>
                <span className={`${styles['badge-number']} ${small ? styles['badge-number--small'] : ''}`}>{level}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
