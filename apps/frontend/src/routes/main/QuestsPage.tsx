// Quest history route with polished UI, strategic layout, and excellent user experience.
import { useMemo } from 'react';
import { BsCheckCircleFill, BsFire, BsStarFill, BsTrophy, BsHexagon } from 'react-icons/bs';
import MainSection from '../../components/MainSection';
import QuestHistoryCard from '../../components/QuestHistoryCard';
import { useQuestPageState } from '../../hooks/page-state/useQuestPageState';
import styles from './QuestsPage.module.css';

export default function QuestsPage() {
  const { daySections, isLoading, isLoadingMore, pageError, canLoadMore, loadMore } =
    useQuestPageState();

  // Calculate session stats for the header summary.
  const historyStats = useMemo(() => {
    if (!daySections.length) return null;

    let totalCompleted = 0;
    let perfectDays = 0;
    
    daySections.forEach(section => {
      const completedCount = section.quests.filter(q => q?.isCompleted).length;
      totalCompleted += completedCount;
      if (completedCount === section.quests.length && section.quests.length > 0) {
        perfectDays += 1;
      }
    });

    return { totalCompleted, perfectDays };
  }, [daySections]);

  return (
    <MainSection className={styles.pageContainer}>
      {/* Decorative background elements */}
      <div className={styles.bgDecoration1} />
      <div className={styles.bgDecoration2} />

      {/* Premium header with title and context. */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Quest Journey</h1>
            <p className={styles.subtitle}>
              {daySections.length > 0
                ? 'Relive your victories and track your path to mastery.'
                : 'Your legend begins here. Start practicing to earn badges!'}
            </p>
          </div>

          {historyStats && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.iconStar}`}>
                  <BsStarFill />
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{historyStats.totalCompleted}</span>
                  <span className={styles.statLabel}>Quests Done</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.iconTrophy}`}>
                  <BsTrophy />
                </div>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{historyStats.perfectDays}</span>
                  <span className={styles.statLabel}>Perfect Days</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.contentWrapper}>
        {/* Loading state with premium visual feedback. */}
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Gathering your achievements...</p>
          </div>
        ) : null}

        {/* Error state with accessible messaging. */}
        {pageError ? (
          <p role="alert" className={styles.errorMessage}>
            {pageError}
          </p>
        ) : null}

        {/* Empty state when no quests are found. */}
        {!isLoading && daySections.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIconContainer}>
              <BsHexagon className={styles.bigEmptyIcon} />
            </div>
            <h3>No Records Yet</h3>
            <p>Your quest history is a blank canvas. Fill it with daily practices!</p>
          </div>
        )}

        {/* Main content with organized day sections. */}
        {!isLoading && daySections.length > 0 && (
          <div className={styles.dayList}>
            <div className={styles.listHeader}>
              <BsFire className={styles.fireIcon} />
              <span>Recent Activity</span>
            </div>
            
            {daySections.map((daySection, index) => {
              // Check if all quests in the day are complete and count them.
              const completedQuestsCount = daySection.quests.filter(
                (quest) => quest && quest.isCompleted,
              ).length;
              const allQuestsComplete = completedQuestsCount === daySection.quests.length;

              return (
                <div key={daySection.questDayUtc} className={styles.dayWrapper}>
                  <div className={styles.timelineGutter}>
                    {allQuestsComplete ? (
                      <BsCheckCircleFill
                        className={`${styles.markerIcon} ${styles.markerCheck}`}
                      />
                    ) : index === 0 ? (
                      <div className={`${styles.markerCircle} ${styles.markerToday}`} />
                    ) : (
                      <div className={`${styles.markerCircle} ${styles.markerIncomplete}`} />
                    )}
                  </div>
                  <section
                    className={`${styles.daySection} ${allQuestsComplete ? styles.completed : ""} ${
                      index === 0 ? styles.isToday : ""
                    }`.trim()}
                  >
                    <div className={styles.dayInfo}>
                      <h2 className={styles.dayLabel}>{daySection.dayLabel}</h2>
                      <p className={styles.dayProgress}>
                        {completedQuestsCount}/{daySection.quests.length} Quests Completed
                      </p>
                    </div>
                    <QuestHistoryCard quests={daySection.quests} />
                  </section>
                </div>
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
                {isLoadingMore ? 'Summoning more...' : 'View Older Quests'}
              </button>
            )}
          </div>
        )}
      </div>
    </MainSection>
  );
}
