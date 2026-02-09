// Verifies module-invites panel orchestration so invite actions and copy behavior stay reliable.
import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { useModuleInvitesPanelState } from './useModuleInvitesPanelState';
import type { ModuleInvite } from '../../types/module';

const mocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
  refetch: vi.fn(),
  logError: vi.fn(),
  clipboardWriteText: vi.fn(),
}));

let invitesQueryState = {
  data: [] as ModuleInvite[],
  isPending: false,
  isRefetching: false,
  error: null as unknown,
  dataUpdatedAt: new Date('2026-02-09T00:00:00.000Z').getTime(),
  refetch: mocks.refetch,
};

let createPending = false;

vi.mock('../../utils/logger', () => ({
  logError: mocks.logError,
}));

vi.mock('../queries/useModuleInvitesQueries', () => ({
  useModuleInvitesQuery: () => invitesQueryState,
  useCreateModuleInviteMutation: () => ({
    mutateAsync: mocks.createMutateAsync,
    isPending: createPending,
  }),
  useUpdateModuleInviteMutation: () => ({
    mutateAsync: mocks.updateMutateAsync,
  }),
  useDeleteModuleInviteMutation: () => ({
    mutateAsync: mocks.deleteMutateAsync,
  }),
}));

describe('useModuleInvitesPanelState', () => {
  const module = {
    id: 10,
    title: 'Biology',
    description: null,
    variantContext: null,
  };

  const invite = {
    id: 201,
    moduleId: 10,
    code: 'CODE',
    maxUses: 2,
    uses: 0,
    expiresAt: null,
    createdAt: '2026-02-09T00:00:00.000Z',
    revokedAt: null,
    createdByUserId: 1,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    invitesQueryState = {
      data: [invite],
      isPending: false,
      isRefetching: false,
      error: null,
      dataUpdatedAt: new Date('2026-02-09T00:00:00.000Z').getTime(),
      refetch: mocks.refetch,
    };
    createPending = false;

    mocks.createMutateAsync.mockReset();
    mocks.updateMutateAsync.mockReset();
    mocks.deleteMutateAsync.mockReset();
    mocks.refetch.mockReset();
    mocks.logError.mockReset();
    mocks.clipboardWriteText.mockReset();
    mocks.clipboardWriteText.mockResolvedValue(undefined);

    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: mocks.clipboardWriteText,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('logs invite-query errors and exposes safe fallback for non ApiError query failures', () => {
    invitesQueryState.error = new Error('network');

    const { result } = renderHook(() =>
      useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
    );

    expect(mocks.logError).toHaveBeenCalledWith(invitesQueryState.error, {
      feature: 'module-invites',
      action: 'list',
      moduleId: 10,
    });
    expect(result.current.inviteError).toBe('Could not load invites right now. Please try again.');
  });

  it('formats invite expiry states consistently', () => {
    const { result } = renderHook(() =>
      useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
    );

    expect(result.current.formatExpiry({ ...invite, revokedAt: '2026-02-09T01:00:00.000Z' })).toBe('Revoked');
    expect(result.current.formatExpiry({ ...invite, uses: 2, maxUses: 2 })).toBe('Expired (max uses reached)');
    expect(result.current.formatExpiry({ ...invite, expiresAt: null })).toBe('No expiry');
  });

  it('creates invite, stores copy link, and allows copying active invite links', async () => {
    mocks.createMutateAsync.mockResolvedValue({
      invite: { ...invite, id: 333 },
      token: 'token-333',
      url: 'http://invite/333',
    });

    const { result } = renderHook(() =>
      useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
    );

    await act(async () => {
      await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mocks.createMutateAsync).toHaveBeenCalledWith({
      expiresInHours: 48,
      maxUses: 100,
    });

    expect(result.current.canCopyInviteLink({ ...invite, id: 333, revokedAt: null })).toBe(true);
  });

  it('handles create/revoke/delete errors with ApiError message and logs failures', async () => {
    const createError = new ApiError({
      message: 'Create failed',
      status: 400,
      code: 'BAD_REQUEST',
      data: {},
    });
    mocks.createMutateAsync.mockRejectedValue(createError);

    const { result } = renderHook(() =>
      useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
    );

    await act(async () => {
      await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(result.current.inviteError).toBe('Create failed');

    mocks.updateMutateAsync.mockRejectedValue(
      new Error('revoke fail'),
    );

    await act(async () => {
      await result.current.handleRevokeInvite(invite);
    });

    expect(result.current.inviteError).toBe('Could not revoke invite. Please try again.');

    mocks.deleteMutateAsync.mockRejectedValue(new Error('delete fail'));

    await act(async () => {
      await result.current.handleDeleteInvite(invite);
    });

    expect(result.current.inviteError).toBe('Could not delete invite. Please try again.');
    expect(mocks.logError).toHaveBeenCalled();
  });

  it('deletes stored invite links after successful delete', async () => {
    mocks.createMutateAsync.mockResolvedValue({
      invite: { ...invite, id: 444 },
      token: 'token-444',
      url: 'http://invite/444',
    });
    mocks.deleteMutateAsync.mockResolvedValue({});

    const { result } = renderHook(() =>
      useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
    );

    await act(async () => {
      await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(result.current.canCopyInviteLink({ ...invite, id: 444, revokedAt: null })).toBe(true);

    await act(async () => {
      await result.current.handleDeleteInvite({ ...invite, id: 444 });
    });

    expect(result.current.canCopyInviteLink({ ...invite, id: 444, revokedAt: null })).toBe(false);
  });

  it('copies invite links and toggles copied state temporarily', async () => {
    mocks.createMutateAsync.mockResolvedValue({
      invite: { ...invite, id: 555 },
      token: 'token-555',
      url: 'http://invite/555',
    });

    const { result } = renderHook(() =>
      useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
    );

    await act(async () => {
      await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    act(() => {
      result.current.copyInviteLink({ ...invite, id: 555 });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.clipboardWriteText).toHaveBeenCalledWith('http://invite/555');
    expect(result.current.isInviteCopied({ ...invite, id: 555 })).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isInviteCopied({ ...invite, id: 555 })).toBe(false);
  });

  it('refreshInvites triggers a query refetch', () => {
    const { result } = renderHook(() =>
      useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
    );

    result.current.refreshInvites();

    expect(mocks.refetch).toHaveBeenCalled();
  });
});
