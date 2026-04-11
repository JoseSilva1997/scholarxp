// Student drill-down panel: shows overview, per-lesson progress, and 7-day performance for a selected student.
import type { RosterStudentDetailResponse } from '@scholarxp/api-contracts';
import defaultAvatar from '@/assets/default-profile-pic.png';
import styles from './StudentDrillDown.module.css';

// Reuse the same URL guard as UserBadge/HeroCard — bare filenames from the DB default are not loadable URLs.
function resolveAvatar(url: string): string {
  return url.startsWith('http') ? url : defaultAvatar;
}

type StudentDrillDownProps = {
  detail: RosterStudentDetailResponse | undefined;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMs(ms: number | null): string {
  if (ms === null) return '--';
  return `${(ms / 1000).toFixed(1)}s`;
}

function SkeletonDetail() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonBar} style={{ width: '60%' }} />
      <div className={styles.skeletonBar} style={{ width: '40%' }} />
      <div className={styles.skeletonBar} style={{ width: '80%' }} />
      <div className={styles.skeletonBar} style={{ width: '50%' }} />
    </div>
  );
}

export default function StudentDrillDown({
  detail,
  isLoading,
  error,
  onClose,
}: StudentDrillDownProps) {
  if (error) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Student Detail</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close student detail">
            &times;
          </button>
        </div>
        <div className={styles.errorMessage} role="alert">{error}</div>
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Student Detail</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close student detail">
            &times;
          </button>
        </div>
        <SkeletonDetail />
      </div>
    );
  }

  const { student, lessonProgress, recentPerformance } = detail;

  return (
    <div className={styles.panel} role="region" aria-label={`Details for ${student.fullName}`}>
      <div className={styles.panelHeader}>
        <div className={styles.studentIdentity}>
          <img src={resolveAvatar(student.avatarUrl)}
               alt=""
               crossOrigin="anonymous"
               referrerPolicy="no-referrer"
               className={styles.avatar} 
               aria-hidden="true" 
               />
          <span className={styles.panelTitle}>{student.fullName}</span>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close student detail">
          &times;
        </button>
      </div>

      {/* Overview */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Overview</h3>
        <div className={styles.statGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Enrolled</span>
            <span className={styles.statValue}>{formatDate(student.enrolledAt)}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Enrolled Via</span>
            <span className={styles.statValue}>{student.enrolledVia}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Proficiency Level</span>
            <span className={styles.statValue}>{student.moduleLevel}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Proficiency XP</span>
            <span className={styles.statValue}>{student.currentXp}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Lessons</span>
            <span className={styles.statValue}>{student.completedLessons}/{student.totalLiveLessons}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Last Activity</span>
            <span className={styles.statValue}>{formatDate(student.lastActivityAt)}</span>
          </div>
        </div>
      </section>

      {/* Lesson Progress */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Lesson Progress</h4>
        {lessonProgress.length === 0 ? (
          <p className={styles.emptyText}>No lesson progress yet.</p>
        ) : (
          <div className={styles.lessonTableWrapper}>
            <table className={styles.lessonTable}>
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th>Completed</th>
                  <th>Mastery</th>
                  <th>Completed At</th>
                  <th>Last Practiced</th>
                </tr>
              </thead>
              <tbody>
                {lessonProgress.map((lp) => (
                  <tr key={lp.moduleUnitId}>
                    <td>{lp.lessonTitle}</td>
                    <td>{lp.isCompleted ? 'Yes' : 'No'}</td>
                    <td>{Math.round(lp.currentMasteryScore)}%</td>
                    <td>{formatDate(lp.completedAt)}</td>
                    <td>{formatDate(lp.lastPracticedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Performance */}
      <section className={styles.bottomSection}>
        <h4 className={styles.sectionTitle}>Recent Performance (7 days)</h4>
        <div className={styles.statGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Accuracy</span>
            <span className={styles.statValue}>
              {recentPerformance.accuracyLast7Days !== null
                ? `${Math.round(recentPerformance.accuracyLast7Days)}%`
                : '--'}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Avg Response Time</span>
            <span className={styles.statValue}>
              {formatMs(recentPerformance.averageTimeMsLast7Days)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Hints Used</span>
            <span className={styles.statValue}>
              {recentPerformance.hintsUsedLast7Days ?? '--'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
