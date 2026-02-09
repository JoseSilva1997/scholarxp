// Verifies SingleModulePage route branches and action wiring using mocked page-state and child components.
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SingleModulePage from './SingleModulePage';

type MockUser = {
  globalRole: 'student' | 'admin';
};

type MockModule = {
  id: number;
  title: string;
  userModuleLevel?: number;
  currentExp?: number;
};

type MockUnit = {
  id: number;
  status: 'draft' | 'live' | 'locked' | 'archived';
};

const mocks = vi.hoisted(() => ({
  setIsStudentViewEnabled: vi.fn(),
  setShowCreateUnit: vi.fn(),
  setIsSettingsOpen: vi.fn(),
  handleCreateUnit: vi.fn(),
  handleChangeUnitStatus: vi.fn(),
  handleModuleSaved: vi.fn(),
}));

let routeParams: { moduleId?: string } = { moduleId: '10' };
let authState: { user: MockUser | null } = { user: { globalRole: 'admin' } };
let pageState: {
  module: MockModule | null;
  moduleUnits: MockUnit[];
  isLoading: boolean;
  pageError: string | null;
  canEditSettings: boolean;
  canToggleStudentView: boolean;
  canManageModuleContent: boolean;
  canManageInvites: boolean;
  isStudentViewEnabled: boolean;
  showCreateUnit: boolean;
  isSettingsOpen: boolean;
  expPercent: number;
  isCreatingUnit: boolean;
} = {
  module: { id: 10, title: 'Biology', userModuleLevel: 3, currentExp: 120 },
  moduleUnits: [
    { id: 1, status: 'live' },
    { id: 2, status: 'draft' },
  ],
  isLoading: false,
  pageError: null,
  canEditSettings: true,
  canToggleStudentView: true,
  canManageModuleContent: true,
  canManageInvites: true,
  isStudentViewEnabled: false,
  showCreateUnit: false,
  isSettingsOpen: false,
  expPercent: 40,
  isCreatingUnit: false,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../hooks/page-state/useSingleModulePageState', () => ({
  useSingleModulePageState: () => ({
    ...pageState,
    setIsStudentViewEnabled: mocks.setIsStudentViewEnabled,
    setShowCreateUnit: mocks.setShowCreateUnit,
    setIsSettingsOpen: mocks.setIsSettingsOpen,
    handleCreateUnit: mocks.handleCreateUnit,
    handleChangeUnitStatus: mocks.handleChangeUnitStatus,
    handleModuleSaved: mocks.handleModuleSaved,
  }),
}));

vi.mock('../../components/MainSection', () => ({
  default: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

vi.mock('../../components/ModuleSettingsPanel', () => ({
  default: ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
    <div>
      <span>settings-open:{String(isOpen)}</span>
      <button onClick={onToggle}>toggle-settings</button>
    </div>
  ),
}));

vi.mock('../../components/CreateModuleUnitCard', () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>open-create-unit</button>
  ),
}));

vi.mock('../../components/Modals/CreateModuleUnitModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div>
      <span>create-unit-open:{String(isOpen)}</span>
      <button onClick={onClose}>close-create-unit</button>
    </div>
  ),
}));

vi.mock('../../components/ModuleUnitCard', () => ({
  default: ({ unit, onChangeStatus }: { unit: MockUnit; onChangeStatus: (id: number, status: MockUnit['status']) => void }) => (
    <button onClick={() => onChangeStatus(unit.id, 'archived')}>module-unit-{unit.id}</button>
  ),
}));

vi.mock('../../components/StudentModuleUnitCard', () => ({
  default: ({ unit }: { unit: MockUnit }) => <div>student-unit-{unit.id}</div>,
}));

describe('SingleModulePage route', () => {
  beforeEach(() => {
    routeParams = { moduleId: '10' };
    authState = { user: { globalRole: 'admin' } };
    pageState = {
      module: { id: 10, title: 'Biology', userModuleLevel: 3, currentExp: 120 },
      moduleUnits: [
        { id: 1, status: 'live' },
        { id: 2, status: 'draft' },
      ],
      isLoading: false,
      pageError: null,
      canEditSettings: true,
      canToggleStudentView: true,
      canManageModuleContent: true,
      canManageInvites: true,
      isStudentViewEnabled: false,
      showCreateUnit: false,
      isSettingsOpen: false,
      expPercent: 40,
      isCreatingUnit: false,
    };

    mocks.setIsStudentViewEnabled.mockReset();
    mocks.setShowCreateUnit.mockReset();
    mocks.setIsSettingsOpen.mockReset();
    mocks.handleCreateUnit.mockReset();
    mocks.handleChangeUnitStatus.mockReset();
    mocks.handleModuleSaved.mockReset();
  });

  it('renders loading and error branches', () => {
    pageState.isLoading = true;
    const { rerender } = render(
      <MemoryRouter>
        <SingleModulePage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Loading module…')).toBeInTheDocument();

    pageState.isLoading = false;
    pageState.pageError = 'Module failed to load';
    rerender(
      <MemoryRouter>
        <SingleModulePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Module failed to load');
  });

  it('renders module content cards and delegates manage-content actions', () => {
    render(
      <MemoryRouter>
        <SingleModulePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Biology' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('module-unit-1'));
    expect(mocks.handleChangeUnitStatus).toHaveBeenCalledWith(1, 'archived');

    fireEvent.click(screen.getByText('open-create-unit'));
    expect(mocks.setShowCreateUnit).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByLabelText('Enable student view'));
    expect(mocks.setIsStudentViewEnabled).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByLabelText('Module settings'));
    expect(mocks.setIsSettingsOpen).toHaveBeenCalled();
  });

  it('renders student progress and only visible student units for student role', () => {
    authState = { user: { globalRole: 'student' } };
    pageState.canManageModuleContent = false;

    render(
      <MemoryRouter>
        <SingleModulePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Level 3')).toBeInTheDocument();
    expect(screen.getByText('120 xp')).toBeInTheDocument();
    expect(screen.getByText('student-unit-1')).toBeInTheDocument();
    expect(screen.queryByText('student-unit-2')).not.toBeInTheDocument();
  });
});
