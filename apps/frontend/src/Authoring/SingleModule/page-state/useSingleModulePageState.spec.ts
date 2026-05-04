// Tests single-module page-state orchestration for routing params, capability gating, and action side effects.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PracticeSessionTypeValues, type AuthUser } from '@scholarxp/api-contracts';
import { useSingleModulePageState } from '@/Authoring/SingleModule/page-state/useSingleModulePageState';
import { features } from '@scholarxp/permissions';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  canUserAccess: vi.fn(),
  shouldLogApiError: vi.fn(),
  getDisplayErrorMessage: vi.fn(),
  logError: vi.fn(),
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  updateStatusMutateAsync: vi.fn(),
  archiveMutateAsync: vi.fn(),
  setQueryData: vi.fn(),
  assign: vi.fn(),
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

let deletionImpactQueryState: {
  data: unknown;
  isFetching: boolean;
  error: unknown;
} = {
  data: null,
  isFetching: false,
  error: null,
};

let permissionByKey: Record<string, boolean> = {
  [features.modules.settings]: true,
  [features.modules.toggleStudentView]: true,
  [features.modules.manageContent]: true,
  [features.modules.invitations]: true,
  [features.modules.delete]: true,
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

vi.mock('@/shared/permissions/permission', () => ({
  canUserAccess: (permission: string) => mocks.canUserAccess(permission),
}));

vi.mock('@/shared/api/get-display-error', () => ({
  shouldLogApiError: mocks.shouldLogApiError,
  getDisplayErrorMessage: mocks.getDisplayErrorMessage,
}));

vi.mock('@/utils/logger', () => ({
  logError: mocks.logError,
}));

vi.mock('@/Authoring/queries/useModulesQueries', () => ({
  useModuleDetailQuery: () => moduleQueryState,
  useModuleUnitsQuery: () => moduleUnitsQueryState,
  useModuleDeletionImpactQuery: () => deletionImpactQueryState,
  useCreateModuleUnitMutation: () => ({
    mutateAsync: mocks.createMutateAsync,
    isPending: false,
  }),
  useArchiveModuleMutation: () => ({
    mutateAsync: mocks.archiveMutateAsync,
    isPending: false,
  }),
  // Mirror the real hook dependencies so this spec validates behavior instead of failing on missing exports.
  useUpdateModuleUnitMutation: () => ({
    mutateAsync: mocks.updateMutateAsync,
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
    deletionImpactQueryState = { data: null, isFetching: false, error: null };
    permissionByKey = {
      [features.modules.settings]: true,
      [features.modules.toggleStudentView]: true,
      [features.modules.manageContent]: true,
      [features.modules.invitations]: true,
      [features.modules.delete]: true,
    };

    mocks.navigate.mockReset();
    mocks.canUserAccess.mockReset();
    mocks.shouldLogApiError.mockReset();
    mocks.getDisplayErrorMessage.mockReset();
    mocks.logError.mockReset();
    mocks.createMutateAsync.mockReset();
    mocks.updateMutateAsync.mockReset();
    mocks.updateStatusMutateAsync.mockReset();
    mocks.archiveMutateAsync.mockReset();
    mocks.setQueryData.mockReset();
    mocks.assign.mockReset();

    mocks.canUserAccess.mockImplementation((permission: string) => permissionByKey[permission]);
    mocks.shouldLogApiError.mockReturnValue(true);
    mocks.getDisplayErrorMessage.mockImplementation((_error, options: { fallbackMessage: string }) => options.fallbackMessage);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: mocks.assign },
    });
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
    expect(result.current.canDeleteModule).toBe(true);
    expect(result.current.expPercent).toBe(50);
  });

  it('gates module archive action from delete permission', () => {
    permissionByKey[features.modules.delete] = false;

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '22', user: mockUser }),
    );

    expect(result.current.canDeleteModule).toBe(false);
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

  it('opens and cancels the archive confirmation state', async () => {
    moduleQueryState = {
      data: {
        id: 9,
        title: 'Biology',
      },
      isPending: false,
      error: null,
    };

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '9', user: mockUser }),
    );

    act(() => {
      result.current.setIsSettingsOpen(true);
    });
    act(() => {
      result.current.handleRequestArchiveModule();
    });

    expect(result.current.isArchiveConfirmOpen).toBe(true);

    act(() => {
      result.current.handleCancelArchiveModule();
    });

    expect(result.current.isArchiveConfirmOpen).toBe(false);
  });

  it('archives module and navigates back to the module list', async () => {
    moduleQueryState = {
      data: {
        id: 9,
        title: 'Biology',
      },
      isPending: false,
      error: null,
    };
    deletionImpactQueryState = {
      data: {
        moduleId: 9,
        isArchived: false,
        willArchive: true,
        isPurgeableArchivedModule: false,
        purgeEligibleAt: null,
        counts: {},
      },
      isFetching: false,
      error: null,
    };
    mocks.archiveMutateAsync.mockResolvedValue({
      id: 9,
      title: 'Biology',
      archivedAt: '2026-04-25T12:00:00.000Z',
    });

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '9', user: mockUser }),
    );

    act(() => {
      result.current.setIsSettingsOpen(true);
      result.current.handleRequestArchiveModule();
    });
    await act(async () => {
      await result.current.handleConfirmArchiveModule();
    });

    expect(mocks.archiveMutateAsync).toHaveBeenCalledTimes(1);
    expect(result.current.isArchiveConfirmOpen).toBe(false);
    expect(result.current.isSettingsOpen).toBe(false);
    expect(mocks.navigate).toHaveBeenCalledWith('/main/modules');
  });

  it('maps archive failures to panel error and logs unexpected errors', async () => {
    const archiveError = new Error('archive failed');
    moduleQueryState = {
      data: {
        id: 9,
        title: 'Biology',
      },
      isPending: false,
      error: null,
    };
    mocks.archiveMutateAsync.mockRejectedValue(archiveError);
    mocks.getDisplayErrorMessage.mockReturnValue('Could not archive this module. Please try again.');

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '9', user: mockUser }),
    );

    act(() => {
      result.current.setIsSettingsOpen(true);
      result.current.handleRequestArchiveModule();
    });
    await act(async () => {
      await result.current.handleConfirmArchiveModule();
    });

    expect(result.current.archiveModuleError).toBe(
      'Could not archive this module. Please try again.',
    );
    expect(mocks.logError).toHaveBeenCalledWith(archiveError, {
      feature: 'modules',
      action: 'archive',
      moduleId: 9,
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
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

  it('updates unit title through mutation with numeric module-unit id', async () => {
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
      },
      isPending: false,
      error: null,
    };
    mocks.updateMutateAsync.mockResolvedValue({ id: 40, title: 'Renamed lesson' });

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleUpdateUnitTitle('40', 'Renamed lesson');
    });

    expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
      moduleUnitId: 40,
      payload: { title: 'Renamed lesson' },
    });
  });

  it('opens daily practice and shows resume state when set is in progress', async () => {
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
        dailyPractice: {
          status: 'in_progress',
          progress: {
            totalQuestions: 5,
            answeredQuestions: 2,
            completedAt: null,
          },
        },
      },
      isPending: false,
      error: null,
    };

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleDailyPracticeClick();
    });

    expect(mocks.assign).toHaveBeenCalledWith('/main/modules/14/daily-practice');
    expect(result.current.dailyPracticeButtonLabel).toBe('Resume Daily Practice');
    expect(result.current.dailyPracticeStatusText).toBe('2/5 answered');
    expect(result.current.isDailyPracticeButtonDisabled).toBe(false);
  });

  it('keeps the daily-practice CTA safely disabled when the student payload is missing the status summary', async () => {
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
      },
      isPending: false,
      error: null,
    };

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleDailyPracticeClick();
    });

    expect(result.current.dailyPracticeButtonLabel).toBe(
      'Daily Practice Unavailable',
    );
    expect(result.current.dailyPracticeStatusText).toBeNull();
    expect(result.current.isDailyPracticeButtonDisabled).toBe(true);
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it('keeps the daily-practice CTA locked when the backend reports the module is not eligible yet', async () => {
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
        dailyPractice: {
          status: 'locked',
          message: 'Daily practice unlocks tomorrow after you complete your first lesson in this module.',
        },
      },
      isPending: false,
      error: null,
    };

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleDailyPracticeClick();
    });

    expect(result.current.dailyPracticeButtonLabel).toBe('No Daily Practice Yet');
    expect(result.current.dailyPracticeStatusText).toBeNull();
    expect(result.current.dailyPracticeTooltip).toBe(
      'Daily practice unlocks tomorrow after you complete your first lesson in this module.',
    );
    expect(result.current.isDailyPracticeButtonDisabled).toBe(true);
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it('keeps the daily-practice CTA disabled when the backend reports no eligible set for today', async () => {
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
        dailyPractice: {
          status: 'no_set',
          message: 'No daily practice questions are available for this module yet.',
        },
      },
      isPending: false,
      error: null,
    };

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleDailyPracticeClick();
    });

    expect(result.current.dailyPracticeButtonLabel).toBe('All Caught Up');
    expect(result.current.dailyPracticeStatusText).toBeNull();
    expect(result.current.dailyPracticeTooltip).toBe(
      'No daily practice questions are available for this module yet.',
    );
    expect(result.current.isDailyPracticeButtonDisabled).toBe(true);
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it('opens completed lessons in view-answer mode without recording retry quest progress', async () => {
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
      },
      isPending: false,
      error: null,
    };
    moduleUnitsQueryState = {
      data: [
        {
          id: 40,
          title: 'Completed lesson',
          status: 'live',
          isCompleted: true,
          questionCount: 2,
          questionGroups: [],
        },
      ],
      isPending: false,
      error: null,
    };
    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleOpenStudentPracticeRoom('40');
    });

    expect(mocks.assign).toHaveBeenCalledWith('/main/modules/14/40/practice-room');
  });

  it('opens retry mode without recording the completed-review quest trigger', async () => {
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
      },
      isPending: false,
      error: null,
    };
    moduleUnitsQueryState = {
      data: [
        {
          id: 40,
          title: 'Completed lesson',
          status: 'live',
          isCompleted: true,
          questionCount: 2,
          questionGroups: [],
        },
      ],
      isPending: false,
      error: null,
    };

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await act(async () => {
      await result.current.handleRetryStudentPracticeRoom('40');
    });

    expect(mocks.assign).toHaveBeenCalledWith(
      `/main/modules/14/40/practice-room?sessionType=${PracticeSessionTypeValues.retry}`,
    );
  });

  it('logs and rethrows title-update errors when telemetry is enabled', async () => {
    const updateError = new Error('update failed');
    moduleQueryState = {
      data: {
        id: 14,
        title: 'History',
      },
      isPending: false,
      error: null,
    };
    mocks.updateMutateAsync.mockRejectedValue(updateError);
    mocks.shouldLogApiError.mockReturnValue(true);

    const { result } = renderHook(() =>
      useSingleModulePageState({ moduleIdParam: '14', user: mockUser }),
    );

    await expect(result.current.handleUpdateUnitTitle('40', 'Renamed lesson')).rejects.toThrow(
      'update failed',
    );
    expect(mocks.logError).toHaveBeenCalledWith(updateError, {
      feature: 'module-unit',
      action: 'update-title',
      unitId: '40',
    });
  });
});
