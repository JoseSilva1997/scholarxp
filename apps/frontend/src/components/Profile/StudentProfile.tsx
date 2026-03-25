// Student profile view: overview stats, enrolled modules, achievements, locker, and lifetime stats.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BsCheckCircleFill,
  BsFire,
  BsLightningChargeFill,
  BsStar,
  BsTrophy,
} from 'react-icons/bs';
import { FaLock } from 'react-icons/fa6';
import type {
  StudentProfileResponse,
  StudentProfileModule,
  RewardItem,
  UpcomingReward,
  RewardCategory,
} from '@scholarxp/api-contracts';
import type { StudentModuleSortKey } from '../../hooks/page-state/useProfilePageState';
import styles from './StudentProfile.module.css';

type StudentProfileProps = {
  profile: StudentProfileResponse;
  moduleSortKey: StudentModuleSortKey;
  onModuleSortChange: (key: StudentModuleSortKey) => void;
};

// --- Overview Strip ---

function OverviewStrip({ profile }: { profile: StudentProfileResponse }) {
  const xpPercent = profile.accountProgress.nextLevelExpRequired > 0
    ? Math.min(100, Math.round(
        (profile.accountProgress.currentLevelExp / profile.accountProgress.nextLevelExpRequired) * 100,
      ))
    : 0;

  const questPercent = profile.todayQuestProgress.total > 0
    ? Math.round((profile.todayQuestProgress.completed / profile.todayQuestProgress.total) * 100)
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
          <span className={styles.statLabel}>Total XP</span>
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
                  title={`${step.rewardXp} XP — ${step.state}`}
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

// --- Modules Section ---

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
      return sorted.sort((a, b) => b.proficiencyLevel - a.proficiencyLevel || b.moduleXP - a.moduleXP);
    case 'weakest':
      return sorted.sort((a, b) => a.proficiencyLevel - b.proficiencyLevel || a.moduleXP - b.moduleXP);
    case 'recent':
      // Daily practice status acts as a recency proxy: done > available > not_available
      return sorted.sort((a, b) => {
        const order = { done: 0, available: 1, not_available: 2 } as const;
        return order[a.dailyPracticeStatus] - order[b.dailyPracticeStatus];
      });
    default:
      return sorted;
  }
}

function proficiencyLabel(level: number): string {
  if (level >= 5) return 'Master';
  if (level >= 4) return 'Expert';
  if (level >= 3) return 'Proficient';
  if (level >= 2) return 'Developing';
  return 'Beginner';
}

function ModulesSection({
  modules,
  sortKey,
  onSortChange,
}: {
  modules: StudentProfileModule[];
  sortKey: StudentModuleSortKey;
  onSortChange: (key: StudentModuleSortKey) => void;
}) {
  const navigate = useNavigate();
  const sorted = useMemo(() => sortModules(modules, sortKey), [modules, sortKey]);

  return (
    <section className={styles.modulesSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Modules</h2>
        <div className={styles.sortTabs}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`${styles.sortTab} ${sortKey === opt.key ? styles.sortTabActive : ''}`}
              onClick={() => onSortChange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className={styles.emptyState}>No enrolled modules yet. Join a module to get started!</p>
      ) : (
        <div className={styles.moduleList}>
          {sorted.map((mod) => {
            const xpPercent = mod.moduleXPMax > 0
              ? Math.min(100, Math.round((mod.moduleXP / mod.moduleXPMax) * 100))
              : 0;

            return (
              <div key={mod.moduleId} className={styles.moduleCard}>
                <div className={styles.moduleCardTop}>
                  <div className={styles.moduleInfo}>
                    <h3 className={styles.moduleTitle}>{mod.title}</h3>
                    <div className={styles.moduleMeta}>
                      <span className={styles.proficiencyBadge} data-level={mod.proficiencyLevel}>
                        Lv.{mod.proficiencyLevel} {proficiencyLabel(mod.proficiencyLevel)}
                      </span>
                      <span className={styles.lessonCount}>
                        {mod.completedLessons}/{mod.totalLessons} lessons
                      </span>
                      {mod.dailyPracticeStatus === 'done' ? (
                        <span className={styles.dailyDone}>
                          <BsCheckCircleFill aria-hidden="true" /> Done today
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.practiceButton}
                    onClick={() => navigate(`/main/modules/${mod.moduleId}`)}
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
                  {mod.moduleXP} / {mod.moduleXPMax} XP
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// --- Achievements Section ---

type AchievementDef = {
  id: string;
  name: string;
  icon: React.ReactNode;
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

function AchievementRow({ title, achievements }: { title: string; achievements: AchievementDef[] }) {
  return (
    <div className={styles.achievementRow}>
      <h3 className={styles.achievementRowTitle}>{title}</h3>
      <div className={styles.achievementScroll}>
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className={`${styles.achievementCard} ${ach.earned ? styles.achievementEarned : styles.achievementLocked}`}
          >
            <div className={styles.achievementIcon}>
              {ach.earned ? ach.icon : <FaLock />}
            </div>
            <span className={styles.achievementName}>{ach.name}</span>
            {ach.earned && ach.dateEarned ? (
              <span className={styles.achievementDate}>{ach.dateEarned}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function AchievementsSection({ profile }: { profile: StudentProfileResponse }) {
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

// --- Locker Section (Scaffold Only) ---

const EQUIPPED_SLOT_LABELS: { category: RewardCategory; label: string }[] = [
  { category: 'avatar_frame', label: 'Avatar Frame' },
  { category: 'profile_background', label: 'Background' },
  { category: 'title_badge', label: 'Title / Badge' },
  { category: 'flair_effect', label: 'Flair Effect' },
];

function LockerSection({ rewards }: { rewards: StudentProfileResponse['rewards'] }) {
  const hasAnyItems = rewards.equipped.length > 0
    || rewards.owned.length > 0
    || rewards.upcoming.length > 0;

  return (
    <section className={styles.lockerSection}>
      <h2 className={styles.sectionTitle}>Locker</h2>

      {!hasAnyItems ? (
        <div className={styles.lockerEmpty}>
          <BsLightningChargeFill className={styles.lockerEmptyIcon} aria-hidden="true" />
          <p className={styles.lockerEmptyText}>
            Your locker is empty for now. Keep levelling up to unlock cosmetics!
          </p>
        </div>
      ) : (
        <div className={styles.lockerContent}>
          {/* Equipped */}
          <div className={styles.lockerGroup}>
            <h3 className={styles.lockerGroupTitle}>Equipped</h3>
            <div className={styles.equippedGrid}>
              {EQUIPPED_SLOT_LABELS.map((slot) => {
                const equipped = rewards.equipped.find((r) => r.category === slot.category);
                return (
                  <div key={slot.category} className={styles.equippedSlot}>
                    {equipped ? (
                      <span className={styles.equippedItemName}>{equipped.name}</span>
                    ) : (
                      <span className={styles.equippedEmpty}>{slot.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Owned */}
          {rewards.owned.length > 0 ? (
            <div className={styles.lockerGroup}>
              <h3 className={styles.lockerGroupTitle}>Owned</h3>
              <div className={styles.ownedGrid}>
                {rewards.owned.map((item: RewardItem) => (
                  <div key={item.id} className={styles.ownedCard}>
                    <span className={styles.ownedName}>{item.name}</span>
                    <span className={`${styles.rarityBadge} ${styles[`rarity_${item.rarity}`]}`}>
                      {item.rarity}
                    </span>
                    <span className={styles.ownedSource}>{item.sourceLabel}</span>
                    {/* TODO: Wire equip handler once rewards backend exists */}
                    <button type="button" className={styles.equipButton} disabled>
                      Equip
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Upcoming */}
          {rewards.upcoming.length > 0 ? (
            <div className={styles.lockerGroup}>
              <h3 className={styles.lockerGroupTitle}>Upcoming</h3>
              <div className={styles.ownedGrid}>
                {rewards.upcoming.map((item: UpcomingReward) => (
                  <div key={item.id} className={`${styles.ownedCard} ${styles.ownedCardLocked}`}>
                    <FaLock className={styles.lockedIcon} aria-hidden="true" />
                    <span className={styles.ownedName}>{item.name}</span>
                    <span className={styles.ownedSource}>Unlocks at Level {item.unlocksAtLevel}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

// --- Stats Section ---

function StatsSection({ profile }: { profile: StudentProfileResponse }) {
  const availableStats = [
    { label: 'Total Quests Completed', value: profile.questHistorySummary.totalCompleted },
    { label: 'Perfect Days', value: profile.questHistorySummary.perfectDays },
    { label: 'Lessons Completed', value: profile.modules.reduce((sum, m) => sum + m.completedLessons, 0) },
    { label: 'Mastery XP Earned', value: profile.totalAccountXP },
    { label: 'Modules in Progress', value: profile.modules.length },
  ];

  // TODO: These stats require backend aggregation that does not exist yet.
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

// --- Main Export ---

export default function StudentProfile({
  profile,
  moduleSortKey,
  onModuleSortChange,
}: StudentProfileProps) {
  return (
    <div className={styles.studentProfile}>
      <OverviewStrip profile={profile} />
      <ModulesSection
        modules={profile.modules}
        sortKey={moduleSortKey}
        onSortChange={onModuleSortChange}
      />
      <AchievementsSection profile={profile} />
      <LockerSection rewards={profile.rewards} />
      <StatsSection profile={profile} />
    </div>
  );
}
