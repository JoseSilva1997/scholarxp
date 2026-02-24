// Verifies modules-page orchestration so listing and create flows remain predictable and safe.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModulesPageState } from './useModulesPageState';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logError: vi.fn(),
  canUserAccess: vi.fn(),
  shouldLogApiError: vi.fn(),
  getDisplayErrorMessage: vi.fn(),
  createMutateAsync: vi.fn(),
  useModulesListQuery: vi.fn(),
}));

let authState: { user: { id: number } | null; isLoading: boolean } = {
  user: { id: 1 },
  isLoading: false,
};

let modulesQueryState = {
  data: [] as Array<{ id: number; title: string }>,
  isPending: false,
  error: null as unknown,
};

let createPending = false;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../api/get-display-error', () => ({
  getDisplayErrorMessage: mocks.getDisplayErrorMessage,
  shouldLogApiError: mocks.shouldLogApiError,
}));

vi.mock('../../utils/logger', () => ({
  logError: mocks.logError,
}));

vi.mock('../../permissions/permission', () => ({
  canUserAccess: mocks.canUserAccess,
}));

vi.mock('../queries/useModulesQueries', () => ({
  useModulesListQuery: (enabled: boolean) => {
    mocks.useModulesListQuery(enabled);
    return modulesQueryState;
  },
  useCreateModuleMutation: () => ({
    mutateAsync: mocks.createMutateAsync,
    isPending: createPending,
  }),
}));

describe('useModulesPageState', () => {
  beforeEach(() => {
    authState = { user: { id: 1 }, isLoading: false };
    modulesQueryState = { data: [], isPending: false, error: null };
    createPending = false;

    mocks.navigate.mockReset();
    mocks.logError.mockReset();
    mocks.canUserAccess.mockReset();
    mocks.shouldLogApiError.mockReset();
    mocks.getDisplayErrorMessage.mockReset();
    mocks.createMutateAsync.mockReset();
    mocks.useModulesListQuery.mockReset();

    mocks.canUserAccess.mockReturnValue(true);
    mocks.shouldLogApiError.mockReturnValue(true);
    mocks.getDisplayErrorMessage.mockImplementation((_error, options: { fallbackMessage: string }) => options.fallbackMessage);
  });

  it('enables modules query when auth is ready and user exists', () => {
    renderHook(() => useModulesPageState());

    expect(mocks.useModulesListQuery).toHaveBeenCalledWith(true);
  });

  it('disables modules query while auth is loading or user is missing', () => {
    authState = { user: null, isLoading: true };

    const { result } = renderHook(() => useModulesPageState());

    expect(mocks.useModulesListQuery).toHaveBeenCalledWith(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('logs list errors when logging policy allows it', () => {
    const listError = new Error('list failed');
    modulesQueryState = {
      data: [],
      isPending: false,
      error: listError,
    };

    renderHook(() => useModulesPageState());

    expect(mocks.logError).toHaveBeenCalledWith(listError, { feature: 'modules', action: 'list' });
  });

  it('creates module successfully and navigates to module detail', async () => {
    mocks.createMutateAsync.mockResolvedValue({ id: 77 });

    const { result } = renderHook(() => useModulesPageState());

    act(() => {
      result.current.openCreateModal();
    });
    expect(result.current.showCreate).toBe(true);

    await act(async () => {
      await result.current.handleCreateModule({ title: 'New module' });
    });

    expect(mocks.createMutateAsync).toHaveBeenCalledWith({ title: 'New module' });
    expect(result.current.showCreate).toBe(false);
  });

  it('surfaces create error message and logs create failure', async () => {
    const createError = new Error('create failed');
    mocks.createMutateAsync.mockRejectedValue(createError);
    mocks.getDisplayErrorMessage.mockReturnValue('Could not create module. Please try again.');

    const { result } = renderHook(() => useModulesPageState());

    await act(async () => {
      await result.current.handleCreateModule({ title: 'Broken module' });
    });

    expect(result.current.createError).toBe('Could not create module. Please try again.');
    expect(mocks.logError).toHaveBeenCalledWith(createError, { feature: 'modules', action: 'create' });
  });

  it('opens an existing module via helper action', () => {
    const { result } = renderHook(() => useModulesPageState());

    result.current.openModule(12);

    expect(mocks.navigate).toHaveBeenCalledWith('/main/modules/12');
  });
});
