// Tests modules query hooks at the cache boundary so mutation side effects stay consistent across screens.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ModuleSummaryResponse, ModuleUnitResponse } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateModuleMutation,
  useUpdateModuleMutation,
  useUpdateModuleUnitStatusMutation,
} from './useModulesQueries';
import { queryKeys } from '../query-keys';

const apiMocks = vi.hoisted(() => ({
  createModule: vi.fn(),
  updateModule: vi.fn(),
  updateModuleUnitStatus: vi.fn(),
}));

vi.mock('../../api/modules', async () => {
  const actual = await vi.importActual<typeof import('../../api/modules')>('../../api/modules');
  return {
    ...actual,
    createModule: apiMocks.createModule,
    updateModule: apiMocks.updateModule,
    updateModuleUnitStatus: apiMocks.updateModuleUnitStatus,
  };
});

function makeModule(partial: Partial<ModuleSummaryResponse> = {}): ModuleSummaryResponse {
  return {
    id: 1,
    title: 'Biology 101',
    description: 'Intro module',
    ...partial,
  };
}

function makeUnit(partial: Partial<ModuleUnitResponse> = {}): ModuleUnitResponse {
  return {
    id: 11,
    moduleId: 1,
    variantContext: 'default',
    title: 'Unit 1',
    questionCount: 0,
    status: 'draft',
    sortOrder: 1,
    createdAt: '2026-02-09T00:00:00.000Z',
    questionGroups: [],
    ...partial,
  };
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useModulesQueries mutations', () => {
  beforeEach(() => {
    apiMocks.createModule.mockReset();
    apiMocks.updateModule.mockReset();
    apiMocks.updateModuleUnitStatus.mockReset();
  });

  it('prepends created module in cache and invalidates modules list', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);
    queryClient.setQueryData(queryKeys.modules.all, [makeModule({ id: 3, title: 'Old' })]);

    const created = makeModule({ id: 9, title: 'New Module' });
    apiMocks.createModule.mockResolvedValue(created);

    const { result } = renderHook(() => useCreateModuleMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: 'New Module' });
    });

    expect(apiMocks.createModule).toHaveBeenCalledWith({ title: 'New Module' });
    expect(queryClient.getQueryData(queryKeys.modules.all)).toEqual([
      created,
      makeModule({ id: 3, title: 'Old' }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.all });
  });

  it('updates detail + list cache entries and invalidates both after update', async () => {
    const moduleId = 4;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);

    queryClient.setQueryData(queryKeys.modules.detail(moduleId), makeModule({ id: moduleId, title: 'Before' }));
    queryClient.setQueryData(queryKeys.modules.all, [
      makeModule({ id: moduleId, title: 'Before' }),
      makeModule({ id: 8, title: 'Other' }),
    ]);

    const updated = makeModule({ id: moduleId, title: 'After' });
    apiMocks.updateModule.mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateModuleMutation(moduleId), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ title: 'After' });
    });

    expect(apiMocks.updateModule).toHaveBeenCalledWith(moduleId, { title: 'After' });
    expect(queryClient.getQueryData(queryKeys.modules.detail(moduleId))).toEqual(updated);
    expect(queryClient.getQueryData(queryKeys.modules.all)).toEqual([
      updated,
      makeModule({ id: 8, title: 'Other' }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.detail(moduleId) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.all });
  });

  it('patches module unit status in cache and invalidates units query', async () => {
    const moduleId = 2;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);

    queryClient.setQueryData(queryKeys.modules.units(moduleId), [
      makeUnit({ id: 12, status: 'draft' }),
      makeUnit({ id: 22, status: 'live' }),
    ]);

    apiMocks.updateModuleUnitStatus.mockResolvedValue(makeUnit({ id: 12, status: 'archived' }));

    const { result } = renderHook(() => useUpdateModuleUnitStatusMutation(moduleId), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        moduleUnitId: 12,
        payload: { status: 'archived' },
      });
    });

    expect(apiMocks.updateModuleUnitStatus).toHaveBeenCalledWith(12, { status: 'archived' });
    expect(queryClient.getQueryData(queryKeys.modules.units(moduleId))).toEqual([
      makeUnit({ id: 12, status: 'archived' }),
      makeUnit({ id: 22, status: 'live' }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.units(moduleId) });
  });

  it('throws a clear error when updating a module without module id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useUpdateModuleMutation(null), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync({ title: 'Nope' })).rejects.toThrow(
      'Missing module id for module update.',
    );
    expect(apiMocks.updateModule).not.toHaveBeenCalled();
  });
});
