// StudentQuestHeaderStatus groups student-only header progress widgets so Header can stay a layout shell.
import DailyLessonXpTrackChip from '@/MainApp/Header/components/DailyLessonXpTrackChip';
import TodayQuestChip from '@/MainApp/Header/components/TodayQuestChip';
import styles from '@/MainApp/Header/components/StudentQuestHeaderStatus.module.css';

type StudentQuestHeaderStatusProps = {
  userId: number;
};

export default function StudentQuestHeaderStatus({
  userId,
}: StudentQuestHeaderStatusProps) {
  return (
    <div className={styles.statusGroup}>
      <TodayQuestChip userId={userId} />
      {/* Thin vertical rule separates the two distinct stat clusters without adding noise */}
      <div className={styles.divider} aria-hidden="true" />
      <DailyLessonXpTrackChip userId={userId} />
    </div>
  );
}
