// Defines achievement presentation separately so milestone rules can evolve without bloating the page shell.
import { useMemo, useState, type ReactNode } from 'react';
import { BsFire, BsStar, BsTrophy } from 'react-icons/bs';
import { FaLock } from 'react-icons/fa6';
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import AchievementDetailModal from './AchievementDetailModal';
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
  requirement: string;
  progressDetail: string;
  statusDetail: string;
};

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function buildAchievements(profile: StudentProfileResponse): {
  questMilestones: AchievementDef[];
  streakMilestones: AchievementDef[];
  masteryMilestones: AchievementDef[];
} {
  const totalCompleted = profile.questHistorySummary.totalCompleted;
  const perfectDays = profile.questHistorySummary.perfectDays;
  const streak = profile.masterQuestStreak;

  const questMilestones: AchievementDef[] = [
    {
      id: 'q-10',
      name: 'Quest Rookie',
      icon: <BsTrophy />,
      earned: totalCompleted >= 10,
      requirement: 'Complete 10 daily quests.',
      progressDetail: `${totalCompleted.toLocaleString()} of 10 daily quests completed.`,
      statusDetail:
        totalCompleted >= 10 ? 'Completed.' : `${(10 - totalCompleted).toLocaleString()} more daily quests needed.`,
    },
    {
      id: 'q-25',
      name: '25 Quests',
      icon: <BsTrophy />,
      earned: totalCompleted >= 25,
      requirement: 'Complete 25 daily quests.',
      progressDetail: `${totalCompleted.toLocaleString()} of 25 daily quests completed.`,
      statusDetail:
        totalCompleted >= 25 ? 'Completed.' : `${(25 - totalCompleted).toLocaleString()} more daily quests needed.`,
    },
    {
      id: 'q-50',
      name: 'Quest Veteran',
      icon: <BsTrophy />,
      earned: totalCompleted >= 50,
      requirement: 'Complete 50 daily quests.',
      progressDetail: `${totalCompleted.toLocaleString()} of 50 daily quests completed.`,
      statusDetail:
        totalCompleted >= 50 ? 'Completed.' : `${(50 - totalCompleted).toLocaleString()} more daily quests needed.`,
    },
    {
      id: 'q-100',
      name: 'Centurion',
      icon: <BsTrophy />,
      earned: totalCompleted >= 100,
      requirement: 'Complete 100 daily quests.',
      progressDetail: `${totalCompleted.toLocaleString()} of 100 daily quests completed.`,
      statusDetail:
        totalCompleted >= 100 ? 'Completed.' : `${(100 - totalCompleted).toLocaleString()} more daily quests needed.`,
    },
  ];

  const streakMilestones: AchievementDef[] = [
    {
      id: 's-3',
      name: '3-Day Streak',
      icon: <BsFire />,
      earned: streak >= 3,
      requirement: 'Reach a 3-day master quest streak.',
      progressDetail: `Current streak: ${streak.toLocaleString()} ${pluralize(streak, 'day', 'days')}.`,
      statusDetail: streak >= 3 ? 'Completed.' : `${(3 - streak).toLocaleString()} more ${pluralize(3 - streak, 'day', 'days')} needed.`,
    },
    {
      id: 's-5',
      name: '5-Day Streak',
      icon: <BsFire />,
      earned: streak >= 5,
      requirement: 'Reach a 5-day master quest streak.',
      progressDetail: `Current streak: ${streak.toLocaleString()} ${pluralize(streak, 'day', 'days')}.`,
      statusDetail: streak >= 5 ? 'Completed.' : `${(5 - streak).toLocaleString()} more ${pluralize(5 - streak, 'day', 'days')} needed.`,
    },
    {
      id: 's-7',
      name: 'Week Warrior',
      icon: <BsFire />,
      earned: streak >= 7,
      requirement: 'Reach a 7-day master quest streak.',
      progressDetail: `Current streak: ${streak.toLocaleString()} ${pluralize(streak, 'day', 'days')}.`,
      statusDetail: streak >= 7 ? 'Completed.' : `${(7 - streak).toLocaleString()} more ${pluralize(7 - streak, 'day', 'days')} needed.`,
    },
  ];

  const masteryMilestones: AchievementDef[] = [
    {
      id: 'm-perfect-1',
      name: 'Perfect Day',
      icon: <BsStar />,
      earned: perfectDays >= 1,
      requirement: 'Earn 1 perfect day by completing every daily quest generated for a UTC day.',
      progressDetail: `${perfectDays.toLocaleString()} of 1 perfect day earned.`,
      statusDetail: perfectDays >= 1 ? 'Completed.' : '1 more perfect day needed.',
    },
    {
      id: 'm-perfect-5',
      name: '5 Perfect Days',
      icon: <BsStar />,
      earned: perfectDays >= 5,
      requirement: 'Earn 5 perfect days by completing every daily quest generated for a UTC day.',
      progressDetail: `${perfectDays.toLocaleString()} of 5 perfect days earned.`,
      statusDetail:
        perfectDays >= 5 ? 'Completed.' : `${(5 - perfectDays).toLocaleString()} more perfect days needed.`,
    },
    {
      id: 'm-perfect-10',
      name: 'Perfection Streak',
      icon: <BsStar />,
      earned: perfectDays >= 10,
      requirement: 'Earn 10 perfect days by completing every daily quest generated for a UTC day.',
      progressDetail: `${perfectDays.toLocaleString()} of 10 perfect days earned.`,
      statusDetail:
        perfectDays >= 10 ? 'Completed.' : `${(10 - perfectDays).toLocaleString()} more perfect days needed.`,
    },
  ];

  return { questMilestones, streakMilestones, masteryMilestones };
}

type AchievementRowProps = {
  title: string;
  achievements: AchievementDef[];
  onSelect: (achievement: AchievementDef) => void;
};

function AchievementRow({ title, achievements, onSelect }: AchievementRowProps) {
  return (
    <div className={styles.achievementRow}>
      <h3 className={styles.achievementRowTitle}>{title}</h3>
      <div className={styles.achievementScroll}>
        {achievements.map((achievement) => (
          <button
            key={achievement.id}
            type="button"
            className={`${styles.achievementCard} ${styles.achievementCardButton} ${achievement.earned ? styles.achievementEarned : styles.achievementLocked}`}
            onClick={() => onSelect(achievement)}
            aria-label={`View details for ${achievement.name}`}
          >
            <div className={styles.achievementIcon}>
              {achievement.earned ? achievement.icon : <FaLock />}
            </div>
            <span className={styles.achievementName}>{achievement.name}</span>
            {achievement.earned && achievement.dateEarned ? (
              <span className={styles.achievementDate}>{achievement.dateEarned}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AchievementsSection({ profile }: AchievementsSectionProps) {
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementDef | null>(null);
  const { questMilestones, streakMilestones, masteryMilestones } = useMemo(
    () => buildAchievements(profile),
    [profile],
  );

  return (
    <>
      <section className={styles.achievementsSection}>
        <h2 className={styles.sectionTitle}>Achievements</h2>
        <AchievementRow
          title="Quest Milestones"
          achievements={questMilestones}
          onSelect={setSelectedAchievement}
        />
        <AchievementRow
          title="Streak Milestones"
          achievements={streakMilestones}
          onSelect={setSelectedAchievement}
        />
        <AchievementRow
          title="Lesson Mastery"
          achievements={masteryMilestones}
          onSelect={setSelectedAchievement}
        />
      </section>
      <AchievementDetailModal
        achievement={selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
      />
    </>
  );
}
