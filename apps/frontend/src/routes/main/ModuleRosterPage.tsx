// Tutor-facing roster page for a single module: summary cards, expandable detail panel with tabs, and student drill-down.
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import MainSection from '@/components/MainSection';
import RosterSummaryCards from '@/components/Roster/RosterSummaryCards';
import RosterDetailsPanel from '@/components/Roster/RosterDetailsPanel';
import { useModuleRosterPageState } from '@/hooks/page-state/useModuleRosterPageState';
import styles from './ModuleRosterPage.module.css';

export default function ModuleRosterPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { user } = useAuth();
  const state = useModuleRosterPageState({ moduleIdParam: moduleId, user });

  if (!state.canViewRoster) {
    return (
      <MainSection>
        <div className={styles.topBar}>
          <Link className={styles.backLink} to={`/main/modules/${moduleId ?? ''}`}>
            &larr; Back to module
          </Link>
        </div>
        <div className={styles.accessDenied} role="alert">
          You do not have permission to view this roster.
        </div>
      </MainSection>
    );
  }

  return (
    <MainSection>
      <div className={styles.topBar}>
        <Link className={styles.backLink} to={`/main/modules/${moduleId ?? ''}`}>
          &larr; Back to module
        </Link>
      </div>

      {state.isLoading ? (
        <div className={styles.loadingPanel}>Loading roster data&hellip;</div>
      ) : state.pageError ? (
        <div className={styles.errorPanel} role="alert">
          {state.pageError}
        </div>
      ) : (
        <>
          {state.summary && (
            <header className={styles.header}>
              <h1 className={styles.title}>
                Manage Roster
              </h1>
              <p className={styles.subtitle}>{state.summary.moduleTitle}</p>
            </header>
          )}

          <RosterSummaryCards
            summary={state.summary}
            isLoading={state.isSummaryLoading}
            onStudentsEnrolledClick={state.handleStudentsEnrolledClick}
            onActiveLast7DaysClick={state.handleActiveLast7DaysClick}
            onAtRiskClick={state.handleAtRiskClick}
            onLessonCoverageClick={state.handleLessonCoverageClick}
          />

          <RosterDetailsPanel
            isOpen={state.isDetailOpen}
            activeTab={state.activeTab}
            onTabChange={state.setActiveTab}
            onClose={state.closeDetail}
            // Students
            studentRows={state.studentRows}
            isStudentsLoading={state.isStudentsLoading}
            studentsError={state.studentsError}
            studentFilter={state.studentFilter}
            onStudentFilterChange={state.setStudentFilter}
            studentSortBy={state.studentSortBy}
            onStudentSortByChange={state.setStudentSortBy}
            studentSortDirection={state.studentSortDirection}
            onStudentSortDirectionChange={state.setStudentSortDirection}
            studentSearch={state.studentSearch}
            onStudentSearchChange={state.setStudentSearch}
            // Lessons
            lessonRows={state.lessonRows}
            isLessonsLoading={state.isLessonsLoading}
            lessonsError={state.lessonsError}
            lessonSortBy={state.lessonSortBy}
            onLessonSortByChange={state.setLessonSortBy}
            lessonSortDirection={state.lessonSortDirection}
            onLessonSortDirectionChange={state.setLessonSortDirection}
            selectedLessonId={state.selectedLessonId}
            onSelectLesson={state.selectLesson}
            onClearSelectedLesson={() => state.selectLesson(null)}
            lessonDrilldown={state.lessonDrilldown}
            isLessonDrilldownLoading={state.isLessonDrilldownLoading}
            lessonDrilldownError={state.lessonDrilldownError}
            // Student drill-down
            selectedStudentId={state.selectedStudentId}
            onSelectStudent={state.selectStudent}
            onClearSelectedStudent={state.clearSelectedStudent}
            studentDetail={state.studentDetail}
            isStudentDetailLoading={state.isStudentDetailLoading}
            studentDetailError={state.studentDetailError}
          />
        </>
      )}
    </MainSection>
  );
}
