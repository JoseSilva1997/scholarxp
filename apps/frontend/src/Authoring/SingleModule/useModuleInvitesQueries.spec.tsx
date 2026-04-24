// Tests invite query mutations at the cache boundary so invite panels remain consistent after edits.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ModuleInviteResponse } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateModuleInviteMutation,
  useDeleteModuleInviteMutation,
  useRedeemInviteMutation,
  useUpdateModuleInviteMutation,
} from '@/Authoring/SingleModule/useModuleInvitesQueries';
import { queryKeys } from '@/shared/hooks/query-keys';

const apiMocks = vi.hoisted(() => ({
  createModuleInvite: vi.fn(),
  updateModuleInvite: vi.fn(),
  deleteModuleInvite: vi.fn(),
  redeemInvite: vi.fn(),
}));

vi.mock('@/Authoring/api/moduleInvites', async () => {
  const actual = await vi.importActual('@/Authoring/api/moduleInvites');
  return {
    ...actual,
    createModuleInvite: apiMocks.createModuleInvite,
    updateModuleInvite: apiMocks.updateModuleInvite,
    deleteModuleInvite: apiMocks.deleteModuleInvite,
    redeemInvite: apiMocks.redeemInvite,
  };
});

function makeInvite(partial: Partial<ModuleInviteResponse> = {}): ModuleInviteResponse {
  return {
    id: 1,
    moduleId: 5,
    code: 'INVITE-CODE',
    maxUses: 10,
    uses: 0,
    expiresAt: null,
    createdAt: '2026-02-09T00:00:00.000Z',
    revokedAt: null,
    createdByUserId: 99,
    ...partial,
  };
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useModuleInvitesQueries mutations', () => {
  beforeEach(() => {
    apiMocks.createModuleInvite.mockReset();
    apiMocks.updateModuleInvite.mockReset();
    apiMocks.deleteModuleInvite.mockReset();
    apiMocks.redeemInvite.mockReset();
  });

  it('prepends created invite in cache and invalidates invites query', async () => {
    const moduleId = 5;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    queryClient.setQueryData(queryKeys.modules.invites(moduleId), [makeInvite({ id: 2 })]);

    const createdInvite = makeInvite({ id: 10, code: 'NEW-CODE' });
    apiMocks.createModuleInvite.mockResolvedValue({
      invite: createdInvite,
      token: 'token-10',
      url: 'http://test/invite/token-10',
    });

    const { result } = renderHook(() => useCreateModuleInviteMutation(moduleId), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ maxUses: 20 });
    });

    expect(apiMocks.createModuleInvite).toHaveBeenCalledWith(moduleId, { maxUses: 20 });
    expect(queryClient.getQueryData(queryKeys.modules.invites(moduleId))).toEqual([
      createdInvite,
      makeInvite({ id: 2 }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.invites(moduleId) });
  });

  it('updates invite in cache and invalidates invites query', async () => {
    const moduleId = 5;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    queryClient.setQueryData(queryKeys.modules.invites(moduleId), [
      makeInvite({ id: 3, maxUses: 3 }),
      makeInvite({ id: 8, maxUses: 8 }),
    ]);

    const updatedInvite = makeInvite({ id: 3, maxUses: 99 });
    apiMocks.updateModuleInvite.mockResolvedValue(updatedInvite);

    const { result } = renderHook(() => useUpdateModuleInviteMutation(moduleId), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        inviteId: 3,
        payload: { maxUses: 99 },
      });
    });

    expect(apiMocks.updateModuleInvite).toHaveBeenCalledWith(moduleId, 3, { maxUses: 99 });
    expect(queryClient.getQueryData(queryKeys.modules.invites(moduleId))).toEqual([
      updatedInvite,
      makeInvite({ id: 8, maxUses: 8 }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.invites(moduleId) });
  });

  it('removes deleted invite from cache and invalidates invites query', async () => {
    const moduleId = 5;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    queryClient.setQueryData(queryKeys.modules.invites(moduleId), [
      makeInvite({ id: 4 }),
      makeInvite({ id: 9 }),
    ]);

    apiMocks.deleteModuleInvite.mockResolvedValue(makeInvite({ id: 4 }));

    const { result } = renderHook(() => useDeleteModuleInviteMutation(moduleId), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(4);
    });

    expect(apiMocks.deleteModuleInvite).toHaveBeenCalledWith(moduleId, 4);
    expect(queryClient.getQueryData(queryKeys.modules.invites(moduleId))).toEqual([
      makeInvite({ id: 9 }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.invites(moduleId) });
  });

  it('invalidates module list and module detail after invite redemption', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    apiMocks.redeemInvite.mockResolvedValue({
      moduleId: 15,
      inviteId: 20,
      enrollmentId: 30,
    });

    const { result } = renderHook(() => useRedeemInviteMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('invite-token');
    });

    expect(apiMocks.redeemInvite).toHaveBeenCalledWith('invite-token');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.modules.detail(15) });
  });

  it('does not block redeem completion on slow invalidations', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
      () => new Promise(() => {}),
    );

    apiMocks.redeemInvite.mockResolvedValue({
      moduleId: 15,
      inviteId: 20,
      enrollmentId: 30,
    });

    const { result } = renderHook(() => useRedeemInviteMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync('invite-token');
      }),
    ).resolves.toBeUndefined();
  });

  it('throws a clear error when creating an invite without module id', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useCreateModuleInviteMutation(null), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync({ maxUses: 1 })).rejects.toThrow(
      'Missing module id for invite creation.',
    );
    expect(apiMocks.createModuleInvite).not.toHaveBeenCalled();
  });
});
