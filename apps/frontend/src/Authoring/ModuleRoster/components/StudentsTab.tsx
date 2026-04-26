// Students tab: primary roster table showing per-student enrollment and progress metrics.
import type {
  RosterStudentRow,
  RosterStudentFilter,
  RosterStudentSortBy,
  SortDirection,
} from '@scholarxp/api-contracts';
import defaultAvatar from '@/assets/default-profile-pic.png';
import { ProficiencyBadge } from '@/Rewards/components/ProficiencyBadge';
import RosterTableToolbar from '@/Authoring/ModuleRoster/components/RosterTableToolbar';
import styles from '@/Authoring/ModuleRoster/components/RosterTable.module.css';

// Reuse the same URL guard as UserBadge/HeroCard — bare filenames from the DB default are not loadable URLs.
function resolveAvatar(url: string): string {
  return url.startsWith('http') ? url : defaultAvatar;
}

const STUDENT_FILTERS: { value: RosterStudentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active_7d', label: 'Active 7d' },
  { value: 'inactive_7d', label: 'Inactive 7d' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'daily_practice_locked', label: 'DP Locked' },
  { value: 'daily_practice_unlocked', label: 'DP Unlocked' },
];

const STUDENT_SORT_OPTIONS: { value: RosterStudentSortBy; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'last_activity', label: 'Recent Activity' },
  { value: 'completed_lessons', label: 'Completed Lessons' },
];

type StudentsTabProps = {
  rows: RosterStudentRow[];
  isLoading: boolean;
  error: string | null;
  filter: RosterStudentFilter;
  onFilterChange: (filter: RosterStudentFilter) => void;
  sortBy: RosterStudentSortBy;
  onSortByChange: (sortBy: RosterStudentSortBy) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (dir: SortDirection) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedStudentId: number | null;
  onSelectStudent: (studentId: number) => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} className={styles.skeletonRow} aria-hidden="true">
          {Array.from({ length: 7 }, (_, j) => (
            <td key={j}>
              <div className={styles.skeletonCell} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function StudentsTab({
  rows,
  isLoading,
  error,
  filter,
  onFilterChange,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  search,
  onSearchChange,
  selectedStudentId,
  onSelectStudent,
}: StudentsTabProps) {
  return (
    <div className={styles.tabContent}>
      <RosterTableToolbar
        filters={STUDENT_FILTERS}
        activeFilter={filter}
        onFilterChange={onFilterChange}
        sortOptions={STUDENT_SORT_OPTIONS}
        activeSortBy={sortBy}
        onSortByChange={onSortByChange}
        sortDirection={sortDirection}
        onSortDirectionChange={onSortDirectionChange}
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search students..."
      />

      {error ? (
        <div className={styles.errorMessage} role="alert">{error}</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.tdLeft}`}>Student</th>
                <th className={`${styles.th} ${styles.thWrap}`}>Proficiency Level</th>
                <th className={`${styles.th} ${styles.thWrap}`}>Experience Points</th>
                <th className={styles.th}>Lessons</th>
                <th className={styles.th}>Mastery</th>
                <th className={styles.th}>Last DP Completed</th>
                <th className={styles.th}>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    No students match the current filter.
                  </td>
                </tr>
              ) : (
                rows.map((student) => (
                  <tr
                    key={student.studentId}
                    className={`${styles.row} ${selectedStudentId === student.studentId ? styles.rowSelected : ''} ${student.isAtRisk ? styles.rowAtRisk : ''}`}
                    onClick={() => onSelectStudent(student.studentId)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={selectedStudentId === student.studentId}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectStudent(student.studentId);
                      }
                    }}
                  >
                    <td className={`${styles.td} ${styles.tdLeft}`}>
                      <div className={styles.studentCell}>
                        <img
                          src={resolveAvatar(student.avatarUrl)}
                          alt=""
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          className={styles.avatar}
                          aria-hidden="true"
                        />
                        <span className={styles.studentName}>{student.fullName}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ProficiencyBadge level={student.moduleLevel} small forceVariant="plain" />
                      </div>
                    </td>
                    <td className={styles.td}>{student.currentXp}</td>
                    <td className={styles.td}>
                      {student.completedLessons}/{student.totalLiveLessons}
                    </td>
                    <td className={styles.td}>{Math.round(student.averageMastery)}%</td>
                    <td className={styles.td}>{formatDate(student.lastDailyPracticeCompletedAt)}</td>
                    <td className={styles.td}>{formatDate(student.lastActivityAt)}</td>
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
