// Verifies ModulesPage route rendering branches and action wiring from the modules page-state hook.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModulesPage from './ModulesPage';

const mocks = vi.hoisted(() => ({
  openCreateModal: vi.fn(),
  closeCreateModal: vi.fn(),
  openModule: vi.fn(),
  handleCreateModule: vi.fn(),
}));

let state = {
  user: { globalRole: 'admin' },
  modules: [] as Array<{ id: number; title: string; description: string | null; institutionId?: number | null }>,
  isLoading: false,
  listErrorMessage: null as string | null,
  canCreateModules: true,
  showCreate: false,
  createError: null as string | null,
  isCreating: false,
};

vi.mock('../../hooks/page-state/useModulesPageState', () => ({
  useModulesPageState: () => ({
    ...state,
    openCreateModal: mocks.openCreateModal,
    closeCreateModal: mocks.closeCreateModal,
    openModule: mocks.openModule,
    handleCreateModule: mocks.handleCreateModule,
  }),
}));

vi.mock('../../components/MainSection', () => ({
  default: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

vi.mock('../../components/Modals/ModuleCreateModal', () => ({
  default: ({ onClose, onCreate }: { onClose: () => void; onCreate: (payload: { title: string }) => Promise<void> }) => (
    <div>
      <button onClick={onClose}>close-create</button>
      <button onClick={() => void onCreate({ title: 'Created from modal' })}>submit-create</button>
    </div>
  ),
}));

describe('ModulesPage route', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    state = {
      user: { globalRole: 'admin' },
      modules: [],
      isLoading: false,
      listErrorMessage: null,
      canCreateModules: true,
      showCreate: false,
      createError: null,
      isCreating: false,
    };
    mocks.openCreateModal.mockReset();
    mocks.closeCreateModal.mockReset();
    mocks.openModule.mockReset();
    mocks.handleCreateModule.mockReset();
    mocks.handleCreateModule.mockResolvedValue(undefined);
  });

  it('renders loading and error branches from hook state', () => {
    state.isLoading = true;
    const { rerender } = render(<ModulesPage />);
    expect(screen.getByText('Loading your modules…')).toBeInTheDocument();

    state.isLoading = false;
    state.listErrorMessage = 'Failed to load modules';
    rerender(<ModulesPage />);
    expect(screen.getByText('Failed to load modules')).toBeInTheDocument();
  });

  it('renders module cards and delegates open action', () => {
    state.modules = [
      { id: 10, title: 'Biology', description: 'Intro', institutionId: 1 },
      { id: 11, title: 'Chemistry', description: null, institutionId: null },
    ];

    render(<ModulesPage />);

    fireEvent.click(screen.getByText('Biology'));
    expect(mocks.openModule).toHaveBeenCalledWith(10);
  });

  it('opens and wires create modal actions', () => {
    state.showCreate = true;

    render(<ModulesPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Open create module form' })[0]);
    expect(mocks.openCreateModal).toHaveBeenCalled();

    fireEvent.click(screen.getByText('close-create'));
    expect(mocks.closeCreateModal).toHaveBeenCalled();

    fireEvent.click(screen.getByText('submit-create'));
    expect(mocks.handleCreateModule).toHaveBeenCalledWith({ title: 'Created from modal' });
  });
});
