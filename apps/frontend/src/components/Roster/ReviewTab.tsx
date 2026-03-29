// Review tab: student-oriented retention overview showing FSRS review health and daily practice status.
import type {
  RosterReviewRow,
  RosterReviewSortBy,
  SortDirection,
} from '@scholarxp/api-contracts';
import defaultAvatar from '@/assets/default-profile-pic.png';
import RosterTableToolbar from './RosterTableToolbar';
import styles from './RosterTable.module.css';

// Reuse the same URL guard as UserBadge/HeroCard — bare filenames from the DB default are not loadable URLs.
function resolveAvatar(url: string): string {
  return url.startsWith('http') ? url : defaultAvatar;
}

const REVIEW_SORT_OPTIONS: { value: RosterReviewSortBy; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'due_review_count', label: 'Due Reviews' },
  { value: 'overdue_review_count', label: 'Overdue Reviews' },
  { value: 'lapse_count', label: 'Lapse Count' },
];

type ReviewTabProps = {
  rows: RosterReviewRow[];
  isLoading: boolean;
  error: string | null;
  sortBy: RosterReviewSortBy;
  onSortByChange: (sortBy: RosterReviewSortBy) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (dir: SortDirection) => void;
  onSelectStudent: (studentId: number) => void;
  selectedStudentId: number | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDailyPracticeStatus(status: string): string {
  const labels: Record<string, string> = {
    locked: 'Locked',
    no_set: 'No Set',
    available: 'Available',
    in_progress: 'In Progress',
    completed: 'Completed',
  };
  return labels[status] ?? status;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} className={styles.skeletonRow} aria-hidden="true">
          {Array.from({ length: 6 }, (_, j) => (
            <td key={j}>
              <div className={styles.skeletonCell} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function ReviewTab({
  rows,
  isLoading,
  error,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  onSelectStudent,
  selectedStudentId,
}: ReviewTabProps) {
  return (
    <div className={styles.tabContent}>
      <RosterTableToolbar
        sortOptions={REVIEW_SORT_OPTIONS}
        activeSortBy={sortBy}
        onSortByChange={onSortByChange}
        sortDirection={sortDirection}
        onSortDirectionChange={onSortDirectionChange}
      />

      {error ? (
        <div className={styles.errorMessage} role="alert">{error}</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Student</th>
                <th className={styles.th}>Due Reviews</th>
                <th className={styles.th}>Overdue</th>
                <th className={styles.th}>Lapses</th>
                <th className={styles.th}>Daily Practice</th>
                <th className={styles.th}>Last DP Completed</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    No review data available yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.studentId}
                    className={`${styles.row} ${selectedStudentId === row.studentId ? styles.rowSelected : ''}`}
                    onClick={() => onSelectStudent(row.studentId)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={selectedStudentId === row.studentId}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectStudent(row.studentId);
                      }
                    }}
                  >
                    <td className={styles.td}>
                      <div className={styles.studentCell}>
                        <img
                          src={resolveAvatar(row.avatarUrl)}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          alt=""
                          className={styles.avatar}
                          aria-hidden="true"
                        />
                        <span className={styles.studentName}>{row.fullName}</span>
                      </div>
                    </td>
                    <td className={styles.td}>{row.dueReviewCount}</td>
                    <td className={styles.td}>
                      <span className={row.overdueReviewCount > 0 ? styles.warningText : ''}>
                        {row.overdueReviewCount}
                      </span>
                    </td>
                    <td className={styles.td}>{row.lapseCount}</td>
                    <td className={styles.td}>
                      {formatDailyPracticeStatus(row.dailyPracticeStatus)}
                    </td>
                    <td className={styles.td}>
                      {formatDate(row.lastDailyPracticeCompletedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
