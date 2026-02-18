// Quest history route with polished UI, strategic layout, and excellent user experience.
import { BsCheckCircleFill } from 'react-icons/bs';
import MainSection from '../../components/MainSection';
import QuestHistoryCard from '../../components/QuestHistoryCard';
import { useQuestPageState } from '../../hooks/page-state/useQuestPageState';
import styles from './QuestsPage.module.css';

export default function QuestsPage() {
  const { daySections, isLoading, isLoadingMore, pageError, canLoadMore, loadMore } =
    useQuestPageState();

  return (
    <MainSection>
      {/* Premium header with title and context. */}
      <div className={styles.header}>
        <h1 className={styles.title}>Quest History</h1>
        <p className={styles.subtitle}>
          {daySections.length > 0
            ? 'Explore your quest history and track your progress'
            : 'No quests yet. Start practicing to earn rewards!'}
        </p>
      </div>

      {/* Loading state with premium visual feedback. */}
      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading your quest history...</p>
        </div>
      ) : null}

      {/* Error state with accessible messaging. */}
      {pageError ? (
        <p role="alert" className={styles.errorMessage}>
          {pageError}
        </p>
      ) : null}

      {/* Main content with organized day sections. */}
      {!isLoading && daySections.length > 0 && (
        <div className={styles.dayList}>
          {daySections.map((daySection) => {
            // Check if all quests in the day are complete.
            const allQuestsComplete = daySection.quests.every(
              (quest) => quest && quest.isCompleted,
            );

            return (
              <section
                key={daySection.questDayUtc}
                className={`${styles.daySection} ${allQuestsComplete ? styles.completed : ''}`.trim()}
              >
                <h2 className={styles.dayLabel}>
                  {allQuestsComplete && (
                    <BsCheckCircleFill className={styles.completedCheckmark} aria-label="Completed" />
                  )}
                  {daySection.dayLabel}
                </h2>
                <QuestHistoryCard quests={daySection.quests} />
              </section>
            );
          })}

          {/* Load more button with premium styling. */}
          {canLoadMore && (
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={loadMore}
              disabled={isLoadingMore}
              aria-busy={isLoadingMore}
            >
              {isLoadingMore ? 'Loading more...' : 'Load more history'}
            </button>
          )}
        </div>
      )}
    </MainSection>
  );
}
