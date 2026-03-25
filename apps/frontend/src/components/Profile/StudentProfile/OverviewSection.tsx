// Renders the student's headline progress metrics so the profile entrypoint only coordinates sections.
import { BsCheckCircleFill, BsFire } from 'react-icons/bs';
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import styles from '../StudentProfile.module.css';

type OverviewSectionProps = {
  profile: StudentProfileResponse;
};

export default function OverviewSection({ profile }: OverviewSectionProps) {
  const xpPercent = profile.accountProgress.nextLevelExpRequired > 0
    ? Math.min(
        100,
        Math.round(
          (profile.accountProgress.currentLevelExp / profile.accountProgress.nextLevelExpRequired)
            * 100,
        ),
      )
    : 0;

  const questPercent = profile.todayQuestProgress.total > 0
    ? Math.round(
        (profile.todayQuestProgress.completed / profile.todayQuestProgress.total) * 100,
      )
    : 0;

  return (
    <section className={styles.overviewSection}>
      <h2 className={styles.sectionTitle}>Overview</h2>
      <div className={styles.overviewGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Account Level</span>
          <span className={styles.statValue}>{profile.accountLevel}</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Mastery XP</span>
          <span className={styles.statValue}>{profile.totalAccountXP.toLocaleString()}</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>XP to Next Level</span>
          <span className={styles.statValue}>{profile.xpToNextLevel}</span>
          <div className={styles.progressRail}>
            <div className={styles.progressFill} style={{ width: `${xpPercent}%` }} />
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Quest Streak</span>
          <span className={styles.statValue}>
            <BsFire className={styles.statIconInline} aria-hidden="true" />
            {profile.masterQuestStreak}
          </span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Today&apos;s Quests</span>
          <span className={styles.statValue}>
            {profile.todayQuestProgress.completed}/{profile.todayQuestProgress.total}
          </span>
          <div className={styles.progressRail}>
            <div
              className={`${styles.progressFill} ${styles.progressFillSecondary}`}
              style={{ width: `${questPercent}%` }}
            />
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Daily Lesson Track</span>
          {profile.dailyLessonXPTrack ? (
            <div className={styles.trackSteps}>
              {profile.dailyLessonXPTrack.steps.map((step) => (
                <span
                  key={step.key}
                  className={`${styles.trackStep} ${styles[`trackStep_${step.state}`]}`}
                  title={`${step.rewardXp} XP - ${step.state}`}
                >
                  {step.state === 'earned' ? (
                    <BsCheckCircleFill aria-hidden="true" />
                  ) : (
                    <span className={styles.trackStepXp}>{step.rewardXp}</span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <span className={styles.statValueMuted}>No track today</span>
          )}
        </div>
      </div>
    </section>
  );
}
