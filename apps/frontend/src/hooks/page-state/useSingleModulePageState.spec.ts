// Tests single-module page-state orchestration for routing params, capability gating, and action side effects.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@scholarxp/api-contracts';
import { useSingleModulePageState } from './useSingleModulePageState';
import { features } from '@scholarxp/permissions';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  canUserAccess: vi.fn(),
  shouldLogApiError: vi.fn(),
  getDisplayErrorMessage: vi.fn(),
  logError: vi.fn(),
  createMutateAsync: vi.fn(),
  updateStatusMutateAsync: vi.fn(),
  setQueryData: vi.fn(),
}));

let moduleQueryState: {
  data: unknown;
  isPending: boolean;
  error: unknown;
} = {
  data: null,
  isPending: false,
  error: null,
};

let moduleUnitsQueryState: {
  data: unknown[];
  isPending: boolean;
  error: unknown;
} = {
  data: [],
  isPending: false,
  error: null,
};

let permissionByKey: Record<string, boolean> = {
  [features.modules.settings]: true,
  [features.modules.toggleStudentView]: true,
  [features.modules.manageContent]: true,
  [features.modules.invitations]: true,
};

const mockUser = { id: 7 } as unknown as AuthUser;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    ...actual,
    useQueryClient: () => ({
      setQueryData: mocks.setQueryData,
    }),
  };
});

vi.mock('../../permissions/permission', () => ({
  canUserAccess: (permission: string) => mocks.canUserAccess(permission),
}));

vi.mock('../../api/get-display-error', () => ({
  shouldLogApiError: mocks.shouldLogApiError,
  getDisplayErrorMessage: mocks.getDisplayErrorMessage,
}));

vi.mock('../../utils/logger', () => ({
  logError: mocks.logError,
}));

vi.mock('../queries/useModulesQueries', () => ({
  useModuleDetailQuery: () => moduleQueryState,
  useModuleUnitsQuery: () => moduleUnitsQueryState,
  useCreateModuleUnitMutation: () => ({
    mutateAsync: mocks.createMutateAsync,
    isPending: false,
  }),
  useUpdateModuleUnitStatusMutation: () => ({
    mutateAsync: mocks.updateStatusMutateAsync,
  }),
}));

describe('useSingleModulePageState', () => {
  beforeEach(() => {
    moduleQueryState = { data: null, isPending: false, error: null };
    moduleUnitsQueryState = { data: [], isPending: false, error: null };
    permissionByKey = {
      [features.modules.settings]: true,
      [features.modules.toggleStudentView]: true,
      [features.modules.manageContent]: true,
      [features.modules.invitations]: true,
    };

    mocks.navigate.mockReset();
    mocks.canUserAccess.mockReset();
    mocks.shouldLogApiError.mockReset();
    mocks.getDisplayErrorMessage.mockReset();
    mocks.logError.mockReset();
    mocks.createMutateAsync.mockReset();
    mocks.updateStatusMutateAsync.mockReset();
    mocks.setQueryData.mockReset();

    mocks.canUserAccess.mockImplementation((permission: string) => permissionByKey[permission]);
    mocks.shouldLogApiError.mockReturnValue(true);
    mocks.getDisplayErrorMessage.mockImplementation((_error, options: { fallbackMessage: string }) => options.fallbackMessage);
  });

  it('returns not-found error when moduleId param is invalid', () => {
    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: 'abc', user: mockUser }),
    );

    expect(result.current.parsedId).toBeNull();
    expect(result.current.pageError).toBe('Module not found. Please check the link and try again.');
    expect(result.current.isLoading).toBe(false);
  });

  it('derives module units, capabilities, and exp percentage from loaded data', () => {
    moduleQueryState = {
      data: {
        id: 22,
        title: 'Algebra',
        currentExp: 25,
        expMax: 50,
      },
      isPending: false,
      error: null,
    };
    moduleUnitsQueryState = {
      data: [
        {
          id: 4,
          title: 'Unit 1',
          status: 'draft',
          isCompleted: true,
          questionCount: 3,
          questionGroups: [
            {
              id: 11,
              name: 'Group A',
              questions: [
                { id: 201, title: 'Question A', lastAttemptResult: 'correct' },
                { id: 202, title: 'Question B', lastAttemptResult: null },
              ],
            },
          ],
        },
      ],
      isPending: false,
      error: null,
    };
    permissionByKey[features.modules.invitations] = false;

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '22', user: mockUser }),
    );

    expect(result.current.moduleUnits).toEqual([
      {
        id: '4',
        title: 'Unit 1',
        status: 'draft',
        isCompleted: true,
        questionCount: 3,
        questionGroups: [
          {
            id: '11',
            title: 'Group A',
            questions: [
              { id: '201', title: 'Question A', lastAttemptResult: 'correct' },
              { id: '202', title: 'Question B', lastAttemptResult: null },
            ],
          },
        ],
      },
    ]);
    expect(result.current.canManageInvites).toBe(false);
    expect(result.current.expPercent).toBe(50);
  });

  it('creates a unit', async () => {
    moduleQueryState = {
      data: {
        id: 9,
        title: 'Biology',
      },
      isPending: false,
      error: null,
    };
    mocks.createMutateAsync.mockResolvedValue({ id: 123 });

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '9', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleCreateUnit('Chapter 1');
    });

    expect(mocks.createMutateAsync).toHaveBeenCalledWith({ title: 'Chapter 1' });
    expect(result.current.showCreateUnit).toBe(false);
  });

  it('maps status-change mutation failures to page error and logs unexpected errors', async () => {
    const statusError = new Error('status failed');
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
      },
      isPending: false,
      error: null,
    };
    mocks.updateStatusMutateAsync.mockRejectedValue(statusError);
    mocks.getDisplayErrorMessage.mockReturnValue(
      'Could not update the lesson status. Please try again.',
    );

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleChangeUnitStatus('40', 'live');
    });

    expect(result.current.pageError).toBe('Could not update the lesson status. Please try again.');
    expect(mocks.logError).toHaveBeenCalledWith(statusError, {
      feature: 'module-unit',
      action: 'status-change',
      moduleUnitId: '40',
      status: 'live',
    });
  });
});
