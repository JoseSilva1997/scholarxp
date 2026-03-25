// Defines achievement presentation separately so milestone rules can evolve without bloating the page shell.
import { useMemo, type ReactNode } from 'react';
import { BsFire, BsStar, BsTrophy } from 'react-icons/bs';
import { FaLock } from 'react-icons/fa6';
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import styles from '../StudentProfile.module.css';

type AchievementsSectionProps = {
  profile: StudentProfileResponse;
};

type AchievementDef = {
  id: string;
  name: string;
  icon: ReactNode;
  earned: boolean;
  dateEarned?: string;
};

function buildAchievements(profile: StudentProfileResponse): {
  questMilestones: AchievementDef[];
  streakMilestones: AchievementDef[];
  masteryMilestones: AchievementDef[];
} {
  const totalCompleted = profile.questHistorySummary.totalCompleted;
  const perfectDays = profile.questHistorySummary.perfectDays;
  const streak = profile.masterQuestStreak;

  const questMilestones: AchievementDef[] = [
    { id: 'q-10', name: 'Quest Rookie', icon: <BsTrophy />, earned: totalCompleted >= 10 },
    { id: 'q-25', name: '25 Quests', icon: <BsTrophy />, earned: totalCompleted >= 25 },
    { id: 'q-50', name: 'Quest Veteran', icon: <BsTrophy />, earned: totalCompleted >= 50 },
    { id: 'q-100', name: 'Centurion', icon: <BsTrophy />, earned: totalCompleted >= 100 },
  ];

  const streakMilestones: AchievementDef[] = [
    { id: 's-3', name: '3-Day Streak', icon: <BsFire />, earned: streak >= 3 },
    { id: 's-5', name: '5-Day Streak', icon: <BsFire />, earned: streak >= 5 },
    { id: 's-7', name: 'Week Warrior', icon: <BsFire />, earned: streak >= 7 },
  ];

  const masteryMilestones: AchievementDef[] = [
    { id: 'm-perfect-1', name: 'Perfect Day', icon: <BsStar />, earned: perfectDays >= 1 },
    { id: 'm-perfect-5', name: '5 Perfect Days', icon: <BsStar />, earned: perfectDays >= 5 },
    { id: 'm-perfect-10', name: 'Perfection Streak', icon: <BsStar />, earned: perfectDays >= 10 },
  ];

  return { questMilestones, streakMilestones, masteryMilestones };
}

type AchievementRowProps = {
  title: string;
  achievements: AchievementDef[];
};

function AchievementRow({ title, achievements }: AchievementRowProps) {
  return (
    <div className={styles.achievementRow}>
      <h3 className={styles.achievementRowTitle}>{title}</h3>
      <div className={styles.achievementScroll}>
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`${styles.achievementCard} ${achievement.earned ? styles.achievementEarned : styles.achievementLocked}`}
          >
            <div className={styles.achievementIcon}>
              {achievement.earned ? achievement.icon : <FaLock />}
            </div>
            <span className={styles.achievementName}>{achievement.name}</span>
            {achievement.earned && achievement.dateEarned ? (
              <span className={styles.achievementDate}>{achievement.dateEarned}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AchievementsSection({ profile }: AchievementsSectionProps) {
  const { questMilestones, streakMilestones, masteryMilestones } = useMemo(
    () => buildAchievements(profile),
    [profile],
  );

  return (
    <section className={styles.achievementsSection}>
      <h2 className={styles.sectionTitle}>Achievements</h2>
      <AchievementRow title="Quest Milestones" achievements={questMilestones} />
      <AchievementRow title="Streak Milestones" achievements={streakMilestones} />
      <AchievementRow title="Lesson Mastery" achievements={masteryMilestones} />
    </section>
  );
}
