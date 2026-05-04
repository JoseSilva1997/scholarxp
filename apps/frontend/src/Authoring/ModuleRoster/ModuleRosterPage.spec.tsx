// Verifies module roster page switches between access, loading, error, and loaded states.
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModuleRosterPage from '@/Authoring/ModuleRoster/ModuleRosterPage';
import { useAuth } from '@/context/AuthContext';
import { useModuleRosterPageState } from '@/Authoring/ModuleRoster/page-state/useModuleRosterPageState';

const routeMocks = vi.hoisted(() => ({
  moduleId: '12' as string | undefined,
}));
const detailsPanelMocks = vi.hoisted(() => ({
  props: vi.fn(),
}));

vi.mock('@/MainApp/MainSection/MainSection', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/Authoring/ModuleRoster/components/RosterSummaryCards', () => ({
  default: () => <section>summary-cards</section>,
}));

vi.mock('@/Authoring/ModuleRoster/components/RosterDetailsPanel', () => ({
  default: (props: { onClearSelectedLesson: () => void }) => {
    detailsPanelMocks.props(props);
    return (
      <section>
        details-panel
        <button type="button" onClick={props.onClearSelectedLesson}>clear-lesson</button>
      </section>
    );
  },
}));

vi.mock('@/Authoring/ModuleRoster/components/ConfirmRemoveStudentModal', () => ({
  default: ({ isOpen, studentName }: { isOpen: boolean; studentName: string }) =>
    isOpen ? <section>remove-modal-{studentName}</section> : null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ moduleId: routeMocks.moduleId }),
  };
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/Authoring/ModuleRoster/page-state/useModuleRosterPageState', () => ({
  useModuleRosterPageState: vi.fn(),
}));

function baseState() {
  return {
    canViewRoster: true,
    isLoading: false,
    pageError: null,
    summary: { moduleTitle: 'Algebra' },
    isSummaryLoading: false,
    activeTab: 'students',
    setActiveTab: vi.fn(),
    handleStudentsEnrolledClick: vi.fn(),
    handleActiveLast7DaysClick: vi.fn(),
    handleAtRiskClick: vi.fn(),
    handleLessonCoverageClick: vi.fn(),
    studentRows: [],
    isStudentsLoading: false,
    studentsError: null,
    studentFilter: 'all',
    setStudentFilter: vi.fn(),
    studentSortBy: 'name',
    setStudentSortBy: vi.fn(),
    studentSortDirection: 'asc',
    setStudentSortDirection: vi.fn(),
    studentSearch: '',
    setStudentSearch: vi.fn(),
    canRemoveStudents: true,
    requestRemoveStudent: vi.fn(),
    lessonRows: [],
    isLessonsLoading: false,
    lessonsError: null,
    lessonSortBy: 'title',
    setLessonSortBy: vi.fn(),
    lessonSortDirection: 'asc',
    setLessonSortDirection: vi.fn(),
    selectedLessonId: null,
    selectLesson: vi.fn(),
    lessonDrilldown: undefined,
    isLessonDrilldownLoading: false,
    lessonDrilldownError: null,
    selectedStudentId: null,
    selectStudent: vi.fn(),
    clearSelectedStudent: vi.fn(),
    studentDetail: undefined,
    isStudentDetailLoading: false,
    studentDetailError: null,
    studentPendingRemoval: null,
    confirmRemoveStudent: vi.fn(),
    cancelRemoveStudent: vi.fn(),
    isRemovingStudent: false,
    removeStudentError: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ModuleRosterPage />
    </MemoryRouter>,
  );
}

describe('ModuleRosterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.moduleId = '12';
    vi.mocked(useAuth).mockReturnValue({ user: { id: 1 } } as never);
    vi.mocked(useModuleRosterPageState).mockReturnValue(baseState() as never);
  });

  it('renders access denied when the state disallows viewing', () => {
    vi.mocked(useModuleRosterPageState).mockReturnValue({
      ...baseState(),
      canViewRoster: false,
    } as never);

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('You do not have permission');
    expect(screen.getByRole('link', { name: /Back to module/i })).toHaveAttribute(
      'href',
      '/main/modules/12',
    );
  });

  it('renders loading and page error states', () => {
    vi.mocked(useModuleRosterPageState).mockReturnValue({
      ...baseState(),
      isLoading: true,
    } as never);
    const { rerender } = renderPage();

    expect(screen.getByText('Loading roster data…')).toBeInTheDocument();

    vi.mocked(useModuleRosterPageState).mockReturnValue({
      ...baseState(),
      pageError: 'Could not load roster data.',
    } as never);
    rerender(
      <MemoryRouter>
        <ModuleRosterPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load roster data.');
  });

  it('renders loaded roster sections and removal modal', () => {
    vi.mocked(useModuleRosterPageState).mockReturnValue({
      ...baseState(),
      studentPendingRemoval: { fullName: 'Ada Student' },
    } as never);

    renderPage();

    expect(screen.getByRole('heading', { name: 'Manage Roster' })).toBeInTheDocument();
    expect(screen.getByText('Algebra')).toBeInTheDocument();
    expect(screen.getByText('summary-cards')).toBeInTheDocument();
    expect(screen.getByText('details-panel')).toBeInTheDocument();
    expect(screen.getByText('remove-modal-Ada Student')).toBeInTheDocument();
  });

  it('handles missing route param, absent summary, and clear lesson callback', () => {
    const selectLesson = vi.fn();
    routeMocks.moduleId = undefined;
    vi.mocked(useModuleRosterPageState).mockReturnValue({
      ...baseState(),
      summary: null,
      selectLesson,
    } as never);

    renderPage();

    expect(screen.getByRole('link', { name: /Back to module/i })).toHaveAttribute(
      'href',
      '/main/modules/',
    );
    expect(screen.queryByRole('heading', { name: 'Manage Roster' })).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'clear-lesson' }).click();
    expect(selectLesson).toHaveBeenCalledWith(null);
  });
});
