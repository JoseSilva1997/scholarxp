// Verifies ModulesPage route rendering branches and action wiring from the modules page-state hook.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModulesPage from '@/Authoring/Modules/ModulesPage';

const mocks = vi.hoisted(() => ({
  openCreateModal: vi.fn(),
  closeCreateModal: vi.fn(),
  openModule: vi.fn(),
  handleCreateModule: vi.fn(),
}));

let mockState = {
  user: { globalRole: 'admin' },
  modules: [] as Array<{ id: number; title: string; description: string | null }>,
  isLoading: false,
  listErrorMessage: null as string | null,
  canCreateModules: true,
  showCreate: false,
  createError: null as string | null,
  isCreating: false,
};

vi.mock('@/Authoring/Modules/page-state/useModulesPageState', () => ({
  useModulesPageState: () => ({
    ...mockState,
    openCreateModal: mocks.openCreateModal,
    closeCreateModal: mocks.closeCreateModal,
    openModule: mocks.openModule,
    handleCreateModule: mocks.handleCreateModule,
  }),
}));

vi.mock('@/MainApp/MainSection/MainSection', () => ({
  default: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

vi.mock('@/Authoring/Modules/components/ModuleCreateModal', () => ({
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
    mockState = {
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
    mockState.isLoading = true;
    const { rerender } = render(<ModulesPage />);
    expect(screen.getByText('Loading your modules…')).toBeInTheDocument();

    mockState.isLoading = false;
    mockState.listErrorMessage = 'Failed to load modules';
    rerender(<ModulesPage />);
    expect(screen.getByText('Failed to load modules')).toBeInTheDocument();
  });

  it('renders module cards and delegates open action', () => {
    mockState.modules = [
      { id: 10, title: 'Biology', description: 'Intro' },
      { id: 11, title: 'Chemistry', description: null },
    ];

    render(<ModulesPage />);

    fireEvent.click(screen.getByText('Biology'));
    expect(mocks.openModule).toHaveBeenCalledWith(10);
  });

  it('opens and wires create modal actions', () => {
    mockState.showCreate = true;

    render(<ModulesPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Open create module form' })[0]);
    expect(mocks.openCreateModal).toHaveBeenCalled();

    fireEvent.click(screen.getByText('close-create'));
    expect(mocks.closeCreateModal).toHaveBeenCalled();

    fireEvent.click(screen.getByText('submit-create'));
    expect(mocks.handleCreateModule).toHaveBeenCalledWith({ title: 'Created from modal' });
  });
});
