// Verifies roster details panel switches tabs and conditionally renders student/lesson drilldowns.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RosterDetailsPanel from '@/Authoring/ModuleRoster/components/RosterDetailsPanel';

vi.mock('@/Authoring/ModuleRoster/components/StudentsTab', () => ({
  default: () => <section>students-tab</section>,
}));

vi.mock('@/Authoring/ModuleRoster/components/LessonsTab', () => ({
  default: () => <section>lessons-tab</section>,
}));

vi.mock('@/Authoring/ModuleRoster/components/StudentDrillDown', () => ({
  default: () => <aside>student-drilldown</aside>,
}));

vi.mock('@/Authoring/ModuleRoster/components/LessonDrillDown', () => ({
  default: () => <aside>lesson-drilldown</aside>,
}));

function baseProps() {
  return {
    activeTab: 'students' as const,
    onTabChange: vi.fn(),
    studentRows: [],
    isStudentsLoading: false,
    studentsError: null,
    studentFilter: 'all' as const,
    onStudentFilterChange: vi.fn(),
    studentSortBy: 'name' as const,
    onStudentSortByChange: vi.fn(),
    studentSortDirection: 'asc' as const,
    onStudentSortDirectionChange: vi.fn(),
    studentSearch: '',
    onStudentSearchChange: vi.fn(),
    canRemoveStudents: true,
    onRequestRemoveStudent: vi.fn(),
    lessonRows: [],
    isLessonsLoading: false,
    lessonsError: null,
    lessonSortBy: 'title' as const,
    onLessonSortByChange: vi.fn(),
    lessonSortDirection: 'asc' as const,
    onLessonSortDirectionChange: vi.fn(),
    selectedLessonId: null,
    onSelectLesson: vi.fn(),
    onClearSelectedLesson: vi.fn(),
    lessonDrilldown: undefined,
    isLessonDrilldownLoading: false,
    lessonDrilldownError: null,
    selectedStudentId: null,
    onSelectStudent: vi.fn(),
    onClearSelectedStudent: vi.fn(),
    studentDetail: undefined,
    isStudentDetailLoading: false,
    studentDetailError: null,
  };
}

describe('RosterDetailsPanel', () => {
  it('renders students tab and student drilldown when active', () => {
    render(<RosterDetailsPanel {...baseProps()} selectedStudentId={34} />);

    expect(screen.getByRole('tab', { name: 'Students' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('students-tab')).toBeInTheDocument();
    expect(screen.getByText('student-drilldown')).toBeInTheDocument();
  });

  it('switches tabs and renders lesson drilldown when lessons are active', () => {
    const props = {
      ...baseProps(),
      activeTab: 'lessons' as const,
      selectedLessonId: 55,
    };
    render(<RosterDetailsPanel {...props} />);

    expect(screen.getByText('lessons-tab')).toBeInTheDocument();
    expect(screen.getByText('lesson-drilldown')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Students' }));
    expect(props.onTabChange).toHaveBeenCalledWith('students');
  });
});
