// Renders the top-level roster metric cards; each card acts as a shortcut to expand the detail panel with a preset tab/filter.
import type { RosterSummaryResponse } from '@scholarxp/api-contracts';
import styles from './RosterSummaryCards.module.css';

type RosterSummaryCardsProps = {
  summary: RosterSummaryResponse | null;
  isLoading: boolean;
  onStudentsEnrolledClick: () => void;
  onActiveLast7DaysClick: () => void;
  onAtRiskClick: () => void;
  onLessonCoverageClick: () => void;
  onReviewBacklogClick: () => void;
};

function SkeletonCard() {
  return (
    <div className={`${styles.card} ${styles.skeleton}`} aria-hidden="true">
      <div className={styles.skeletonLabel} />
      <div className={styles.skeletonValue} />
    </div>
  );
}

export default function RosterSummaryCards({
  summary,
  isLoading,
  onStudentsEnrolledClick,
  onActiveLast7DaysClick,
  onAtRiskClick,
  onLessonCoverageClick,
  onReviewBacklogClick,
}: RosterSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className={styles.grid} aria-label="Loading roster summary">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const coverageLabel = summary.lessonCoverage.totalLiveLessons > 0
    ? `${summary.lessonCoverage.lessonsCompletedByAtLeastOneStudent}/${summary.lessonCoverage.totalLiveLessons}`
    : '0/0';

  return (
    <div className={styles.grid} role="group" aria-label="Roster summary">
      <button
        type="button"
        className={styles.card}
        onClick={onStudentsEnrolledClick}
        aria-label={`${summary.studentsEnrolled} students enrolled. View all students.`}
      >
        <span className={styles.label}>Students Enrolled</span>
        <span className={styles.value}>{summary.studentsEnrolled}</span>
      </button>

      <button
        type="button"
        className={styles.card}
        onClick={onActiveLast7DaysClick}
        aria-label={`${summary.activeLast7Days} active in last 7 days. View active students.`}
      >
        <span className={styles.label}>Active in Last 7 Days</span>
        <span className={styles.value}>{summary.activeLast7Days}</span>
      </button>

      <button
        type="button"
        className={`${styles.card} ${summary.atRiskCount > 0 ? styles.cardWarning : ''}`}
        onClick={onAtRiskClick}
        aria-label={`${summary.atRiskCount} at-risk students. View at-risk students.`}
      >
        <span className={styles.label}>At Risk</span>
        <span className={styles.value}>{summary.atRiskCount}</span>
      </button>

      <button
        type="button"
        className={styles.card}
        onClick={onLessonCoverageClick}
        aria-label={`Lesson coverage ${coverageLabel}. View lesson details.`}
      >
        <span className={styles.label}>Lesson Coverage</span>
        <span className={styles.value}>{coverageLabel}</span>
        <span className={styles.subtitle}>completed by at least 1 student</span>
      </button>

      <button
        type="button"
        className={`${styles.card} ${summary.reviewBacklog.totalOverdueReviews > 0 ? styles.cardWarning : ''}`}
        onClick={onReviewBacklogClick}
        aria-label={`${summary.reviewBacklog.totalOverdueReviews} overdue reviews across ${summary.reviewBacklog.studentsWithOverdueReviews} students. View review backlog.`}
      >
        <span className={styles.label}>Review Backlog</span>
        <span className={styles.value}>{summary.reviewBacklog.totalOverdueReviews}</span>
        <span className={styles.subtitle}>
          {summary.reviewBacklog.studentsWithOverdueReviews} student{summary.reviewBacklog.studentsWithOverdueReviews !== 1 ? 's' : ''}
        </span>
      </button>
    </div>
  );
}
