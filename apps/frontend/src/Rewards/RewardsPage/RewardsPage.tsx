// Rewards discovery page: view-only progression timeline showing every cosmetic and its unlock level.
import MainSection from '@/MainApp/MainSection/MainSection';
import RewardsTimeline from '@/Rewards/RewardsPage/components/RewardsTimeline';
import { useRewardsTimelineState } from '@/Rewards/RewardsPage/page-state/useRewardsTimelineState';
import styles from '@/Rewards/RewardsPage/RewardsPage.module.css';

export default function RewardsPage() {
  const { level, timelineItems } = useRewardsTimelineState();

  return (
    <MainSection className={styles.pageContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Rewards</h1>
        <p className={styles.subtitle}>
          Your progression roadmap - every cosmetic you can unlock on the journey to level 100.
        </p>
      </div>

      <RewardsTimeline level={level} timelineItems={timelineItems} />
    </MainSection>
  );
}
