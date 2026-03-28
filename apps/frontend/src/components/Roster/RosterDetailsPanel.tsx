// Expandable details panel beneath summary cards; contains Students, Lessons, and Review tabs.
import type { RosterTab } from '../../hooks/page-state/useModuleRosterPageState';
import type {
  RosterStudentRow,
  RosterStudentFilter,
  RosterStudentSortBy,
  RosterLessonRow,
  RosterLessonSortBy,
  RosterReviewRow,
  RosterReviewSortBy,
  SortDirection,
  RosterStudentDetailResponse,
} from '@scholarxp/api-contracts';
import StudentsTab from './StudentsTab';
import LessonsTab from './LessonsTab';
import ReviewTab from './ReviewTab';
import StudentDrillDown from './StudentDrillDown';
import styles from './RosterDetailsPanel.module.css';

type RosterDetailsPanelProps = {
  isOpen: boolean;
  activeTab: RosterTab;
  onTabChange: (tab: RosterTab) => void;
  onClose: () => void;

  // Students
  studentRows: RosterStudentRow[];
  isStudentsLoading: boolean;
  studentsError: string | null;
  studentFilter: RosterStudentFilter;
  onStudentFilterChange: (f: RosterStudentFilter) => void;
  studentSortBy: RosterStudentSortBy;
  onStudentSortByChange: (s: RosterStudentSortBy) => void;
  studentSortDirection: SortDirection;
  onStudentSortDirectionChange: (d: SortDirection) => void;
  studentSearch: string;
  onStudentSearchChange: (v: string) => void;

  // Lessons
  lessonRows: RosterLessonRow[];
  isLessonsLoading: boolean;
  lessonsError: string | null;
  lessonSortBy: RosterLessonSortBy;
  onLessonSortByChange: (s: RosterLessonSortBy) => void;
  lessonSortDirection: SortDirection;
  onLessonSortDirectionChange: (d: SortDirection) => void;

  // Review
  reviewRows: RosterReviewRow[];
  isReviewLoading: boolean;
  reviewError: string | null;
  reviewSortBy: RosterReviewSortBy;
  onReviewSortByChange: (s: RosterReviewSortBy) => void;
  reviewSortDirection: SortDirection;
  onReviewSortDirectionChange: (d: SortDirection) => void;

  // Student drill-down
  selectedStudentId: number | null;
  onSelectStudent: (id: number) => void;
  onClearSelectedStudent: () => void;
  studentDetail: RosterStudentDetailResponse | undefined;
  isStudentDetailLoading: boolean;
  studentDetailError: string | null;
};

const TAB_LABELS: { key: RosterTab; label: string }[] = [
  { key: 'students', label: 'Students' },
  { key: 'lessons', label: 'Lessons' },
  { key: 'review', label: 'Review' },
];

export default function RosterDetailsPanel({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  studentRows,
  isStudentsLoading,
  studentsError,
  studentFilter,
  onStudentFilterChange,
  studentSortBy,
  onStudentSortByChange,
  studentSortDirection,
  onStudentSortDirectionChange,
  studentSearch,
  onStudentSearchChange,
  lessonRows,
  isLessonsLoading,
  lessonsError,
  lessonSortBy,
  onLessonSortByChange,
  lessonSortDirection,
  onLessonSortDirectionChange,
  reviewRows,
  isReviewLoading,
  reviewError,
  reviewSortBy,
  onReviewSortByChange,
  reviewSortDirection,
  onReviewSortDirectionChange,
  selectedStudentId,
  onSelectStudent,
  onClearSelectedStudent,
  studentDetail,
  isStudentDetailLoading,
  studentDetailError,
}: RosterDetailsPanelProps) {
  if (!isOpen) return null;

  // Show drill-down below the table when viewing students or review tab
  const showDrillDown =
    selectedStudentId !== null && (activeTab === 'students' || activeTab === 'review');

  return (
    <div className={styles.panel} role="region" aria-label="Roster details">
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist" aria-label="Roster detail tabs">
          {TAB_LABELS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              aria-selected={activeTab === tab.key}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close details panel"
        >
          &times;
        </button>
      </div>

      <div className={styles.tabPanel} role="tabpanel" aria-label={`${activeTab} tab`}>
        {activeTab === 'students' && (
          <StudentsTab
            rows={studentRows}
            isLoading={isStudentsLoading}
            error={studentsError}
            filter={studentFilter}
            onFilterChange={onStudentFilterChange}
            sortBy={studentSortBy}
            onSortByChange={onStudentSortByChange}
            sortDirection={studentSortDirection}
            onSortDirectionChange={onStudentSortDirectionChange}
            search={studentSearch}
            onSearchChange={onStudentSearchChange}
            selectedStudentId={selectedStudentId}
            onSelectStudent={onSelectStudent}
          />
        )}
        {activeTab === 'lessons' && (
          <LessonsTab
            rows={lessonRows}
            isLoading={isLessonsLoading}
            error={lessonsError}
            sortBy={lessonSortBy}
            onSortByChange={onLessonSortByChange}
            sortDirection={lessonSortDirection}
            onSortDirectionChange={onLessonSortDirectionChange}
          />
        )}
        {activeTab === 'review' && (
          <ReviewTab
            rows={reviewRows}
            isLoading={isReviewLoading}
            error={reviewError}
            sortBy={reviewSortBy}
            onSortByChange={onReviewSortByChange}
            sortDirection={reviewSortDirection}
            onSortDirectionChange={onReviewSortDirectionChange}
            onSelectStudent={onSelectStudent}
            selectedStudentId={selectedStudentId}
          />
        )}
      </div>

      {showDrillDown && (
        <StudentDrillDown
          detail={studentDetail}
          isLoading={isStudentDetailLoading}
          error={studentDetailError}
          onClose={onClearSelectedStudent}
        />
      )}
    </div>
  );
}
