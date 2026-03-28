// Keeps module ranking and navigation isolated so profile orchestration stays declarative.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsCheckCircleFill } from 'react-icons/bs';
import type { StudentProfileModule } from '@scholarxp/api-contracts';
import type { StudentModuleSortKey } from '../../../hooks/page-state/useProfilePageState';
import styles from '../StudentProfile.module.css';

type ModulesSectionProps = {
  modules: StudentProfileModule[];
  sortKey: StudentModuleSortKey;
  onSortChange: (key: StudentModuleSortKey) => void;
};

const SORT_OPTIONS: { key: StudentModuleSortKey; label: string }[] = [
  { key: 'strongest', label: 'Strongest' },
  { key: 'weakest', label: 'Weakest' },
  { key: 'recent', label: 'Recently Practiced' },
];

function sortModules(
  modules: StudentProfileModule[],
  sortKey: StudentModuleSortKey,
): StudentProfileModule[] {
  const sorted = [...modules];

  switch (sortKey) {
    case 'strongest':
      return sorted.sort(
        (a, b) => b.proficiencyLevel - a.proficiencyLevel || b.moduleXP - a.moduleXP,
      );
    case 'weakest':
      return sorted.sort(
        (a, b) => a.proficiencyLevel - b.proficiencyLevel || a.moduleXP - b.moduleXP,
      );
    case 'recent':
      // Daily practice status is the closest signal we have until the API exposes practice timestamps.
      return sorted.sort((a, b) => {
        const order = { done: 0, available: 1, not_available: 2 } as const;
        return order[a.dailyPracticeStatus] - order[b.dailyPracticeStatus];
      });
    default:
      return sorted;
  }
}

export default function ModulesSection({
  modules,
  sortKey,
  onSortChange,
}: ModulesSectionProps) {
  const navigate = useNavigate();
  const sortedModules = useMemo(() => sortModules(modules, sortKey), [modules, sortKey]);

  return (
    <section className={styles.modulesSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Modules</h2>
        <div className={styles.sortTabs}>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`${styles.sortTab} ${sortKey === option.key ? styles.sortTabActive : ''}`}
              onClick={() => onSortChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {sortedModules.length === 0 ? (
        <p className={styles.emptyState}>No enrolled modules yet. Join a module to get started!</p>
      ) : (
        <div className={styles.moduleList}>
          {sortedModules.map((module) => {
            const xpPercent = module.moduleXPMax > 0
              ? Math.min(100, Math.round((module.moduleXP / module.moduleXPMax) * 100))
              : 0;

            return (
              <div key={module.moduleId} className={styles.moduleCard}>
                <div className={styles.moduleCardTop}>
                  <div className={styles.moduleInfo}>
                    <h3 className={styles.moduleTitle}>{module.title}</h3>
                    <div className={styles.moduleMeta}>
                      <span
                        className={styles.proficiencyBadge}
                        title="Practice level reflects cumulative module XP, not a fixed mastery rating."
                      >
                        Practice Lv.{module.proficiencyLevel}
                      </span>
                      <span className={styles.lessonCount}>
                        {module.completedLessons}/{module.totalLessons} lessons
                      </span>
                      {module.dailyPracticeStatus === 'done' ? (
                        <span className={styles.dailyDone}>
                          <BsCheckCircleFill aria-hidden="true" /> Done today
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.practiceButton}
                    onClick={() => navigate(`/main/modules/${module.moduleId}`)}
                  >
                    Practice
                  </button>
                </div>
                <div className={styles.moduleProgressBar}>
                  <div
                    className={styles.moduleProgressFill}
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
                <div className={styles.moduleXpLabel}>
                  {module.moduleXP} / {module.moduleXPMax} XP
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
