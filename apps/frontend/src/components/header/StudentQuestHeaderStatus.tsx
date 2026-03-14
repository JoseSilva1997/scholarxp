// StudentQuestHeaderStatus groups student-only header progress widgets so Header can stay a layout shell.
import MasterQuestStreakChip from './MasterQuestStreakChip';
import TodayQuestChip from './TodayQuestChip';
import styles from './StudentQuestHeaderStatus.module.css';

type StudentQuestHeaderStatusProps = {
  userId: number;
};

export default function StudentQuestHeaderStatus({
  userId,
}: StudentQuestHeaderStatusProps) {
  return (
    <div className={styles.statusGroup}>
      <TodayQuestChip userId={userId} />
      <MasterQuestStreakChip userId={userId} />
    </div>
  );
}
