// Rewards discovery page: view-only progression timeline showing every cosmetic and its unlock level.
import MainSection from '../../components/MainSection';
import RewardsTimeline from '../../components/Rewards/RewardsTimeline';
import { useRewardsTimelineState } from '../../hooks/page-state/useRewardsTimelineState';
import styles from './RewardsPage.module.css';

export default function RewardsPage() {
  const { level, timelineItems } = useRewardsTimelineState();

  return (
    <MainSection className={styles.pageContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Rewards</h1>
        <p className={styles.subtitle}>
          Your progression roadmap — every cosmetic you can unlock on the journey to level 100.
        </p>
        <span className={styles.levelChip}>Level {level}</span>
      </div>

      <RewardsTimeline level={level} timelineItems={timelineItems} />
    </MainSection>
  );
}
