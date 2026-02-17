// Quest history route currently showcases static day sections so card/date layout can be validated before API wiring.
import MainSection from '../../components/MainSection';
import QuestHistoryCard from '../../components/QuestHistoryCard';
import { useQuestPageState } from '../../hooks/page-state/useQuestPageState';
import styles from './QuestsPage.module.css';

export default function QuestsPage() {
  const { daySections } = useQuestPageState();

  return (
    <MainSection>
      <h1>Quest History</h1>
      <div className={styles.dayList}>
        {daySections.map((daySection) => (
          <section key={daySection.questDayUtc} className={styles.daySection}>
            <p className={styles.dayLabel}>{daySection.dayLabel}</p>
            <QuestHistoryCard />
          </section>
        ))}
      </div>
    </MainSection>
  );
}
