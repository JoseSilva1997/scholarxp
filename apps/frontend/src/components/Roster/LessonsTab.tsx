// Lessons tab: per-lesson adoption and completion visibility across enrolled students.
import type {
  RosterLessonRow,
  RosterLessonSortBy,
  SortDirection,
} from '@scholarxp/api-contracts';
import RosterTableToolbar from './RosterTableToolbar';
import styles from './RosterTable.module.css';

const LESSON_SORT_OPTIONS: { value: RosterLessonSortBy; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'completion_rate', label: 'Completion Rate' },
  { value: 'average_mastery', label: 'Average Mastery' },
  { value: 'last_practiced', label: 'Last Practiced' },
];

type LessonsTabProps = {
  rows: RosterLessonRow[];
  isLoading: boolean;
  error: string | null;
  sortBy: RosterLessonSortBy;
  onSortByChange: (sortBy: RosterLessonSortBy) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (dir: SortDirection) => void;
  selectedLessonId: number | null;
  onSelectLesson: (id: number | null) => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    live: 'Live',
    locked: 'Locked',
    archived: 'Archived',
  };
  return labels[status] ?? status;
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

export default function LessonsTab({
  rows,
  isLoading,
  error,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  selectedLessonId,
  onSelectLesson,
}: LessonsTabProps) {
  return (
    <div className={styles.tabContent}>
      <RosterTableToolbar
        sortOptions={LESSON_SORT_OPTIONS}
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
                <th className={styles.th}>Lesson</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Started</th>
                <th className={styles.th}>Completed</th>
                <th className={styles.th}>Completion Rate</th>
                <th className={styles.th}>Avg Mastery</th>
                <th className={styles.th}>Last Practiced</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    No live lessons in this module yet.
                  </td>
                </tr>
              ) : (
                rows.map((lesson) => (
                  <tr
                    key={lesson.moduleUnitId}
                    className={`${styles.row} ${selectedLessonId === lesson.moduleUnitId ? styles.rowSelected : ''}`}
                    onClick={() => onSelectLesson(lesson.moduleUnitId)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={selectedLessonId === lesson.moduleUnitId}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectLesson(lesson.moduleUnitId);
                      }
                    }}
                  >
                    <td className={styles.td}>
                      <span className={styles.lessonTitle}>{lesson.title}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${styles[`status_${lesson.status}`] ?? ''}`}>
                        {formatStatus(lesson.status)}
                      </span>
                    </td>
                    <td className={styles.td}>{lesson.studentsStarted}</td>
                    <td className={styles.td}>{lesson.studentsCompleted}</td>
                    <td className={styles.td}>{Math.round(lesson.completionRate)}%</td>
                    <td className={styles.td}>{Math.round(lesson.averageMastery)}%</td>
                    <td className={styles.td}>{formatDate(lesson.lastPracticedAt)}</td>
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
