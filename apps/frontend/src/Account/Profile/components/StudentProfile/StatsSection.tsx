// Separates lifetime metrics from the profile shell so future backend aggregates can land without reshaping the page.
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import styles from '@/Account/Profile/components/StudentProfile.module.css';

type StatsSectionProps = {
  profile: StudentProfileResponse;
};

export default function StatsSection({ profile }: StatsSectionProps) {
  const availableStats = [
    { label: 'Total Quests Completed', value: profile.questHistorySummary.totalCompleted },
    { label: 'Perfect Days', value: profile.questHistorySummary.perfectDays },
    {
      label: 'Lessons Completed',
      value: profile.modules.reduce((sum, module) => sum + module.completedLessons, 0),
    },
    { label: 'Modules in Progress', value: profile.modules.length },
  ];

  // These tiles stay visible so the page layout does not jump when the missing backend aggregates arrive.
  const comingSoonStats = [
    'First-try Accuracy',
    'Active Days per Month',
    'Reward Unlock History',
  ];

  return (
    <section className={styles.statsSection}>
      <h2 className={styles.sectionTitle}>Stats</h2>
      <div className={styles.statsGrid}>
        {availableStats.map((stat) => (
          <div key={stat.label} className={styles.lifetimeStat}>
            <span className={styles.lifetimeValue}>{stat.value.toLocaleString()}</span>
            <span className={styles.lifetimeLabel}>{stat.label}</span>
          </div>
        ))}
        {comingSoonStats.map((label) => (
          <div key={label} className={`${styles.lifetimeStat} ${styles.lifetimeStatSoon}`}>
            <span className={styles.lifetimeValue}>--</span>
            <span className={styles.lifetimeLabel}>{label}</span>
            <span className={styles.comingSoon}>Coming soon</span>
          </div>
        ))}
      </div>
    </section>
  );
}
