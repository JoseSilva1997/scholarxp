// Persistent details panel beneath summary cards; contains Students and Lessons tabs.
import type { RosterTab } from '@/Authoring/ModuleRoster/page-state/useModuleRosterPageState';
import type {
  LessonDrilldownResponse,
  RosterStudentRow,
  RosterStudentFilter,
  RosterStudentSortBy,
  RosterLessonRow,
  RosterLessonSortBy,
  SortDirection,
  RosterStudentDetailResponse,
} from '@scholarxp/api-contracts';
import StudentsTab from '@/Authoring/ModuleRoster/components/StudentsTab';
import LessonsTab from '@/Authoring/ModuleRoster/components/LessonsTab';
import StudentDrillDown from '@/Authoring/ModuleRoster/components/StudentDrillDown';
import LessonDrillDown from '@/Authoring/ModuleRoster/components/LessonDrillDown';
import styles from '@/Authoring/ModuleRoster/components/RosterDetailsPanel.module.css';

type RosterDetailsPanelProps = {
  activeTab: RosterTab;
  onTabChange: (tab: RosterTab) => void;

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
  canRemoveStudents: boolean;
  onRequestRemoveStudent: (student: RosterStudentRow) => void;

  // Lessons
  lessonRows: RosterLessonRow[];
  isLessonsLoading: boolean;
  lessonsError: string | null;
  lessonSortBy: RosterLessonSortBy;
  onLessonSortByChange: (s: RosterLessonSortBy) => void;
  lessonSortDirection: SortDirection;
  onLessonSortDirectionChange: (d: SortDirection) => void;
  selectedLessonId: number | null;
  onSelectLesson: (id: number | null) => void;
  onClearSelectedLesson: () => void;
  lessonDrilldown: LessonDrilldownResponse | undefined;
  isLessonDrilldownLoading: boolean;
  lessonDrilldownError: string | null;

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
];

// Coordinates roster tab rendering and mutually exclusive student/lesson drilldown panels.
export default function RosterDetailsPanel({
  activeTab,
  onTabChange,
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
  canRemoveStudents,
  onRequestRemoveStudent,
  lessonRows,
  isLessonsLoading,
  lessonsError,
  lessonSortBy,
  onLessonSortByChange,
  lessonSortDirection,
  onLessonSortDirectionChange,
  selectedLessonId,
  onSelectLesson,
  onClearSelectedLesson,
  lessonDrilldown,
  isLessonDrilldownLoading,
  lessonDrilldownError,
  selectedStudentId,
  onSelectStudent,
  onClearSelectedStudent,
  studentDetail,
  isStudentDetailLoading,
  studentDetailError,
}: RosterDetailsPanelProps) {
  // Keep drilldown visibility tied to active tab so stale selections do not display in the wrong context.
  const showStudentDrillDown = selectedStudentId !== null && activeTab === 'students';
  const showLessonDrillDown = selectedLessonId !== null && activeTab === 'lessons';

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
            canRemoveStudents={canRemoveStudents}
            onRequestRemoveStudent={onRequestRemoveStudent}
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
            selectedLessonId={selectedLessonId}
            onSelectLesson={onSelectLesson}
          />
        )}
      </div>

      {showStudentDrillDown && (
        <StudentDrillDown
          detail={studentDetail}
          isLoading={isStudentDetailLoading}
          error={studentDetailError}
          onClose={onClearSelectedStudent}
        />
      )}

      {showLessonDrillDown && (
        <LessonDrillDown
          key={selectedLessonId}
          detail={lessonDrilldown}
          isLoading={isLessonDrilldownLoading}
          error={lessonDrilldownError}
          onClose={onClearSelectedLesson}
        />
      )}
    </div>
  );
}
