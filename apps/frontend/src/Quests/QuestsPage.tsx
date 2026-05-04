// Defines the Quests route, combining page-state data with the visual quest-history timeline.
import { useMemo, useState } from 'react';
import { BsCheckCircleFill, BsFire, BsStarFill, BsTrophy, BsHexagon } from 'react-icons/bs';
import { GiLockedChest, GiOpenTreasureChest } from 'react-icons/gi';
import MainSection from '@/MainApp/MainSection/MainSection';
import QuestHistoryCard from '@/Quests/components/quest-history/QuestHistoryCard';
import { useQuestPageState } from '@/Quests/page-state/useQuestPageState';
import styles from '@/Quests/QuestsPage.module.css';

// Renders the student's quest journey, including summary statistics, daily quest badges, and master quest state.
export default function QuestsPage() {
  const { daySections, isLoading, isLoadingMore, pageError, canLoadMore, loadMore } =
    useQuestPageState();
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  // Summary metrics are derived client-side from the loaded sections because they are presentation-only totals.
  const historyStats = useMemo(() => {
    if (!daySections.length) return null;

    let totalCompleted = 0;
    let perfectDays = 0;
    
    daySections.forEach(section => {
      const completedCount = section.quests.filter((q) => q.isCompleted).length;
      totalCompleted += completedCount;
      if (section.masterQuest?.isCompleted) {
        perfectDays += 1;
      }
    });

    return { totalCompleted, perfectDays };
  }, [daySections]);

  return (
    <MainSection className={styles.pageContainer}>
      {/* Background layers are kept in the route so the reusable card components stay presentation-agnostic. */}
      <div className={styles.bgDecoration1} />
      <div className={styles.bgDecoration2} />

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
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Gathering your achievements...</p>
          </div>
        ) : null}

        {pageError ? (
          <p role="alert" className={styles.errorMessage}>
            {pageError}
          </p>
        ) : null}

        {!isLoading && daySections.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIconContainer}>
              <BsHexagon className={styles.bigEmptyIcon} />
            </div>
            <h3>No Records Yet</h3>
            <p>Your quest history is a blank canvas. Fill it with daily practices!</p>
          </div>
        )}

        {!isLoading && daySections.length > 0 && (
          <div className={styles.dayList}>
            <div className={styles.listHeader}>
              <BsFire className={styles.fireIcon} />
              <span>Recent Activity</span>
            </div>
            
            {daySections.map((daySection) => {
              const isPlaceholder = daySection.isPlaceholder;
              const completedQuestsCount = daySection.quests.filter(
                (quest) => quest.isCompleted,
              ).length;
              const dailyQuestCount = daySection.quests.length;
              // Prefer the explicit master-quest record when present; placeholders and empty days cannot complete it.
              const allQuestsComplete =
                (!isPlaceholder &&
                  (daySection.masterQuest?.isCompleted ??
                (completedQuestsCount === dailyQuestCount &&
                  dailyQuestCount > 0))) ||
                false;
              const MasterQuestIcon = allQuestsComplete
                ? GiOpenTreasureChest
                : GiLockedChest;

              return (
                <div key={daySection.questDayUtc} className={styles.dayWrapper}>
                  <div className={styles.timelineGutter}>
                    {allQuestsComplete ? (
                      <BsCheckCircleFill
                        className={`${styles.markerIcon} ${styles.markerCheck}`}
                      />
                    ) : daySection.isToday ? (
                      <div className={`${styles.markerCircle} ${styles.markerToday}`} />
                    ) : (
                      <div className={`${styles.markerCircle} ${styles.markerIncomplete}`} />
                    )}
                  </div>
                  <section
                    className={`${styles.daySection} ${allQuestsComplete ? styles.completed : ""} ${
                      daySection.isToday ? styles.isToday : ""
                    } ${isPlaceholder ? styles.placeholderSection : ''}`.trim()}
                  >
                    <div className={styles.dayInfo}>
                      <h2 className={styles.dayLabel}>{daySection.dayLabel}</h2>
                      <p className={styles.dayProgress}>
                        {isPlaceholder
                          ? 'No daily quests were generated for this day.'
                          : `${completedQuestsCount}/${dailyQuestCount} ${
                              dailyQuestCount === 1 ? 'Quest' : 'Quests'
                            } Completed`}
                      </p>
                    </div>
                    <div className={styles.dayQuestRow}>
                      {isPlaceholder ? (
                        <div
                          className={styles.questHistoryPlaceholder}
                          aria-hidden="true"
                          data-testid="quest-history-placeholder"
                        />
                      ) : (
                        <QuestHistoryCard
                          quests={daySection.quests}
                          activeTooltipId={activeTooltipId}
                          onTooltipToggle={setActiveTooltipId}
                          tooltipIdPrefix={daySection.questDayUtc}
                        />
                      )}
                      <div className={styles.masterQuestSeparator} aria-hidden="true" />
                      <div
                        className={`${styles.masterQuestIndicator} ${
                          isPlaceholder
                            ? styles.masterQuestIndicatorPlaceholder
                            : allQuestsComplete
                            ? styles.masterQuestIndicatorComplete
                            : styles.masterQuestIndicatorIncomplete
                        }`.trim()}
                        role="img"
                        aria-label={
                          isPlaceholder
                            ? 'No master quest available'
                            : allQuestsComplete
                            ? 'Master quest completed'
                            : 'Master quest incomplete'
                        }
                        title={
                          isPlaceholder
                            ? 'No master quest exists for days without generated daily quests.'
                            : daySection.masterQuest?.description ??
                              'Complete every daily quest available today to unlock the master quest reward.'
                        }
                      >
                        <MasterQuestIcon
                          className={styles.masterQuestIndicatorIcon}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              );
            })}

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
