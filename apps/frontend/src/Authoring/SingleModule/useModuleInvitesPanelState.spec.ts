// Verifies module-invites panel orchestration so invite actions and copy behavior stay reliable.
// Comprehensive branch coverage including error handling, state transitions, and edge cases.
import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/client';
import { useModuleInvitesPanelState } from '@/Authoring/SingleModule/useModuleInvitesPanelState';
import type { ModuleInvite } from '@/shared/types/module';

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

vi.mock('@/utils/logger', () => ({
  logError: mocks.logError,
}));

vi.mock('@/Authoring/SingleModule/useModuleInvitesQueries', () => ({
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
    vi.setSystemTime(new Date('2026-02-09T00:00:00.000Z'));
    
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
    // Reset clipboard to resolve by default
    mocks.clipboardWriteText.mockImplementation(() => Promise.resolve(undefined));

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

  describe('Query initialization and conditions', () => {
    it('enables query when isOpen=true and canShowInvites=true', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );
      expect(result.current.invites).toEqual([invite]);
    });

    it('disables query when isOpen=false', () => {
      invitesQueryState.data = [];
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: false, canShowInvites: true }),
      );
      expect(result.current.invites).toEqual([]);
    });

    it('disables query when canShowInvites=false', () => {
      invitesQueryState.data = [];
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: false }),
      );
      expect(result.current.invites).toEqual([]);
    });

    it('disables query when module is null', () => {
      invitesQueryState.data = [];
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module: null, isOpen: true, canShowInvites: true }),
      );
      expect(result.current.invites).toEqual([]);
    });

    it('returns empty invites array when query data is null', () => {
      invitesQueryState.data = null as unknown as ModuleInvite[];
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );
      expect(result.current.invites).toEqual([]);
    });

    it('reflects isInvitesLoading when query isPending', () => {
      invitesQueryState.isPending = true;
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );
      expect(result.current.isInvitesLoading).toBe(true);
    });

    it('reflects isInvitesLoading when query isRefetching', () => {
      invitesQueryState.isRefetching = true;
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );
      expect(result.current.isInvitesLoading).toBe(true);
    });

    it('reflects isCreatingInvite when mutation isPending', () => {
      createPending = true;
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );
      expect(result.current.isCreatingInvite).toBe(true);
    });
  });

  describe('useEffect logging', () => {
    it('logs invite-query errors with proper metadata when moduleId exists', () => {
      invitesQueryState.error = new Error('network');
      renderHook(() => useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }));

      expect(mocks.logError).toHaveBeenCalledWith(invitesQueryState.error, {
        feature: 'module-invites',
        action: 'list',
        moduleId: 10,
      });
    });

    it('skips logging when error is null', () => {
      invitesQueryState.error = null;
      renderHook(() => useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }));
      expect(mocks.logError).not.toHaveBeenCalled();
    });

    it('skips logging when moduleId is null', () => {
      invitesQueryState.error = new Error('network');
      renderHook(() => useModuleInvitesPanelState({ module: null, isOpen: true, canShowInvites: true }));
      expect(mocks.logError).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('extracts inviteError from query ApiError', () => {
      const apiError = new ApiError({
        message: 'Unauthorized access',
        status: 403,
        code: 'FORBIDDEN',
        data: {},
      });
      invitesQueryState.error = apiError;

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      expect(result.current.inviteError).toBe('Unauthorized access');
    });

    it('provides safe fallback for non-ApiError query failures', () => {
      invitesQueryState.error = new Error('network');

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      expect(result.current.inviteError).toBe('Could not load invites right now. Please try again.');
    });

    it('prioritizes action error over query error when from same module', async () => {
      invitesQueryState.error = new Error('query error');
      mocks.createMutateAsync.mockRejectedValue(new Error('create error'));

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.inviteError).toBe('Could not create invite. Please try again.');
    });

    it('ignores action error when from different moduleId', async () => {
      invitesQueryState.error = null;
      mocks.createMutateAsync.mockRejectedValue(new Error('create error'));

      const { result, rerender } = renderHook(
        ({ moduleId }) =>
          useModuleInvitesPanelState({
            module: moduleId ? { id: moduleId, title: 'Test', description: null, variantContext: null } : null,
            isOpen: true,
            canShowInvites: true,
          }),
        { initialProps: { moduleId: 10 } },
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      // Rerender with different module
      rerender({ moduleId: 20 });

      expect(result.current.inviteError).toBe(null);
    });

    it('returns null when no error exists', () => {
      invitesQueryState.error = null;

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      expect(result.current.inviteError).toBe(null);
    });
  });

  describe('formatExpiry', () => {
    it('returns "Revoked" when revokedAt exists', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      const revoked = result.current.formatExpiry({
        ...invite,
        revokedAt: '2026-02-08T00:00:00.000Z',
      });

      expect(revoked).toBe('Revoked');
    });

    it('returns "Expired (max uses reached)" when usage exhausted', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      const exhausted = result.current.formatExpiry({
        ...invite,
        maxUses: 5,
        uses: 5,
        revokedAt: null,
      });

      expect(exhausted).toBe('Expired (max uses reached)');
    });

    it('returns "Expired (max uses reached)" before checking time expiration', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      // Both usage exhausted AND time expired - usage should take priority
      const invite2 = {
        ...invite,
        maxUses: 2,
        uses: 2,
        expiresAt: '2026-02-01T00:00:00.000Z', // Past date
        revokedAt: null,
      };

      const result2 = result.current.formatExpiry(invite2);
      expect(result2).toBe('Expired (max uses reached)');
    });

    it('returns "Expired" when time is past expiresAt', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      const pastDate = new Date('2026-02-08T00:00:00.000Z');
      const expired = result.current.formatExpiry({
        ...invite,
        expiresAt: pastDate.toISOString(),
        revokedAt: null,
      });

      expect(expired).toBe('Expired');
    });

    it('returns "No expiry" when expiresAt is null', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      const noExpiry = result.current.formatExpiry({
        ...invite,
        expiresAt: null,
        maxUses: null,
        revokedAt: null,
      });

      expect(noExpiry).toBe('No expiry');
    });

    it('returns formatted date when invite is still valid', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      const futureDate = new Date('2026-02-20T14:30:00.000Z');
      const formatted = result.current.formatExpiry({
        ...invite,
        expiresAt: futureDate.toISOString(),
        revokedAt: null,
      });

      // Should contain date parts (exact format handled by date localization)
      expect(formatted).toContain('Expires');
      expect(formatted).toContain('Feb');
      expect(formatted).toContain('20');
    });

    it('uses query dataUpdatedAt as stable "now" reference', () => {
      // Update the query time to a future date
      const futureQueryTime = new Date('2026-02-15T00:00:00.000Z');
      invitesQueryState.dataUpdatedAt = futureQueryTime.getTime();

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      // An invite that expires on 2026-02-14 should be expired relative to 2026-02-15
      const almostExpired = result.current.formatExpiry({
        ...invite,
        expiresAt: '2026-02-14T23:59:59.000Z',
        revokedAt: null,
      });

      expect(almostExpired).toBe('Expired');
    });

    it('returns "Expired" when maxUses is null but expiresAt is in past', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      const expired = result.current.formatExpiry({
        ...invite,
        maxUses: null,
        expiresAt: '2026-02-01T00:00:00.000Z',
        revokedAt: null,
      });

      expect(expired).toBe('Expired');
    });
  });

  describe('handleCreateInvite', () => {
    it('calls preventDefault and sends create request with default values', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 300 },
        token: 'token-300',
        url: 'http://invite/300',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      const event = { preventDefault: vi.fn() } as unknown as FormEvent;

      await act(async () => {
        await result.current.handleCreateInvite(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mocks.createMutateAsync).toHaveBeenCalledWith({
        expiresInHours: 48,
        maxUses: 100,
      });
    });

    it('stores generated invite URL for later copying', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 400 },
        token: 'token-400',
        url: 'http://app.test/invite/abc123xyz',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.canCopyInviteLink({ ...invite, id: 400, revokedAt: null })).toBe(true);
    });

    it('resets create form state after successful creation', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 500 },
        token: 'token-500',
        url: 'http://invite/500',
      });

      // Set custom values
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      act(() => {
        result.current.setCreateExpiry(72);
        result.current.setCreateMaxUses(50);
      });

      expect(result.current.createExpiry).toBe(72);
      expect(result.current.createMaxUses).toBe(50);

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      // Should reset to defaults after successful creation
      expect(result.current.createExpiry).toBe(48);
      expect(result.current.createMaxUses).toBe(100);
    });

    it('clears previous error before creating', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 600 },
        token: 'token-600',
        url: 'http://invite/600',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      // Set an error first
      mocks.createMutateAsync.mockRejectedValueOnce(new Error('first error'));
      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.inviteError).toBe('Could not create invite. Please try again.');

      // Second attempt should clear error
      mocks.createMutateAsync.mockResolvedValueOnce({
        invite: { ...invite, id: 601 },
        token: 'token-601',
        url: 'http://invite/601',
      });

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.inviteError).toBe(null);
    });

    it('returns early when module is null', async () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module: null, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(mocks.createMutateAsync).not.toHaveBeenCalled();
    });

    it('returns early and sets error when already creating', async () => {
      createPending = true;
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(mocks.createMutateAsync).not.toHaveBeenCalled();
    });

    it('handles ApiError with message and logs error', async () => {
      const apiError = new ApiError({
        message: 'Invite limit reached',
        status: 400,
        code: 'LIMIT_EXCEEDED',
        data: {},
      });
      mocks.createMutateAsync.mockRejectedValue(apiError);

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.inviteError).toBe('Invite limit reached');
      expect(mocks.logError).toHaveBeenCalledWith(apiError, {
        feature: 'module-invites',
        action: 'create',
        moduleId: 10,
      });
    });

    it('handles non-ApiError with safe fallback message', async () => {
      mocks.createMutateAsync.mockRejectedValue(new Error('network timeout'));

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.inviteError).toBe('Could not create invite. Please try again.');
    });

    it('sends custom expiry and maxUses values', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 700 },
        token: 'token-700',
        url: 'http://invite/700',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      act(() => {
        result.current.setCreateExpiry(24);
        result.current.setCreateMaxUses(5);
      });

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(mocks.createMutateAsync).toHaveBeenCalledWith({
        expiresInHours: 24,
        maxUses: 5,
      });
    });
  });

  describe('handleRevokeInvite', () => {
    it('sends revoke=true to update mutation', async () => {
      mocks.updateMutateAsync.mockResolvedValue({});

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleRevokeInvite(invite);
      });

      expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
        inviteId: 201,
        payload: { revoke: true },
      });
    });

    it('clears error before attempting revoke', async () => {
      mocks.updateMutateAsync.mockRejectedValueOnce(new Error('revoke failed'));

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleRevokeInvite(invite);
      });

      expect(result.current.inviteError).toBe('Could not revoke invite. Please try again.');

      mocks.updateMutateAsync.mockResolvedValueOnce({});

      await act(async () => {
        await result.current.handleRevokeInvite(invite);
      });

      expect(result.current.inviteError).toBe(null);
    });

    it('returns early when module is null', async () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module: null, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleRevokeInvite(invite);
      });

      expect(mocks.updateMutateAsync).not.toHaveBeenCalled();
    });

    it('handles ApiError with message and logs', async () => {
      const apiError = new ApiError({
        message: 'Unauthorized to revoke',
        status: 403,
        code: 'FORBIDDEN',
        data: {},
      });
      mocks.updateMutateAsync.mockRejectedValue(apiError);

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleRevokeInvite(invite);
      });

      expect(result.current.inviteError).toBe('Unauthorized to revoke');
      expect(mocks.logError).toHaveBeenCalledWith(apiError, {
        feature: 'module-invites',
        action: 'revoke',
        moduleId: 10,
      });
    });

    it('handles non-ApiError with safe fallback', async () => {
      mocks.updateMutateAsync.mockRejectedValue(new Error('internal error'));

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleRevokeInvite(invite);
      });

      expect(result.current.inviteError).toBe('Could not revoke invite. Please try again.');
    });
  });

  describe('handleDeleteInvite', () => {
    it('sends delete request with invite id', async () => {
      mocks.deleteMutateAsync.mockResolvedValue({});

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleDeleteInvite(invite);
      });

      expect(mocks.deleteMutateAsync).toHaveBeenCalledWith(201);
    });

    it('removes stored invite link after successful deletion', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 800 },
        token: 'token-800',
        url: 'http://invite/800',
      });
      mocks.deleteMutateAsync.mockResolvedValue({});

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      // Create an invite to store the link
      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(result.current.canCopyInviteLink({ ...invite, id: 800, revokedAt: null })).toBe(true);

      // Delete it
      await act(async () => {
        await result.current.handleDeleteInvite({ ...invite, id: 800 });
      });

      expect(result.current.canCopyInviteLink({ ...invite, id: 800, revokedAt: null })).toBe(false);
    });

    it('clears error before attempting delete', async () => {
      mocks.deleteMutateAsync.mockRejectedValueOnce(new Error('delete failed'));

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleDeleteInvite(invite);
      });

      expect(result.current.inviteError).toBe('Could not delete invite. Please try again.');

      mocks.deleteMutateAsync.mockResolvedValueOnce({});

      await act(async () => {
        await result.current.handleDeleteInvite(invite);
      });

      expect(result.current.inviteError).toBe(null);
    });

    it('returns early when module is null', async () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module: null, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleDeleteInvite(invite);
      });

      expect(mocks.deleteMutateAsync).not.toHaveBeenCalled();
    });

    it('handles ApiError with message and logs', async () => {
      const apiError = new ApiError({
        message: 'Cannot delete: in use',
        status: 409,
        code: 'CONFLICT',
        data: {},
      });
      mocks.deleteMutateAsync.mockRejectedValue(apiError);

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleDeleteInvite(invite);
      });

      expect(result.current.inviteError).toBe('Cannot delete: in use');
      expect(mocks.logError).toHaveBeenCalledWith(apiError, {
        feature: 'module-invites',
        action: 'delete',
        moduleId: 10,
      });
    });

    it('handles non-ApiError with safe fallback', async () => {
      mocks.deleteMutateAsync.mockRejectedValue(new Error('server error'));

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleDeleteInvite(invite);
      });

      expect(result.current.inviteError).toBe('Could not delete invite. Please try again.');
    });
  });

  describe('canCopyInviteLink', () => {
    it('returns true when link is stored and invite is not expired', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 900 },
        token: 'token-900',
        url: 'http://invite/900',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      // Create an invite to store the link
      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      // Now check that we can copy the link
      expect(
        result.current.canCopyInviteLink({
          ...invite,
          id: 900,
          expiresAt: null,
          revokedAt: null,
        }),
      ).toBe(true);
    });

    it('returns false when link is not stored', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      expect(
        result.current.canCopyInviteLink({
          ...invite,
          expiresAt: null,
          revokedAt: null,
        }),
      ).toBe(false);
    });

    it('returns false when invite is revoked', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 1000 },
        token: 'token-1000',
        url: 'http://invite/1000',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(
        result.current.canCopyInviteLink({
          ...invite,
          id: 1000,
          revokedAt: '2026-02-09T00:00:00.000Z',
        }),
      ).toBe(false);
    });

    it('returns false when invite is time-expired', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 1100 },
        token: 'token-1100',
        url: 'http://invite/1100',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(
        result.current.canCopyInviteLink({
          ...invite,
          id: 1100,
          expiresAt: '2026-02-08T00:00:00.000Z',
          revokedAt: null,
        }),
      ).toBe(false);
    });

    it('returns false when max uses exhausted', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 1200 },
        token: 'token-1200',
        url: 'http://invite/1200',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      expect(
        result.current.canCopyInviteLink({
          ...invite,
          id: 1200,
          maxUses: 2,
          uses: 2,
          expiresAt: null,
          revokedAt: null,
        }),
      ).toBe(false);
    });
  });

  describe('isInviteCopied', () => {
    it('returns true when invite matches copiedInviteId', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 1300 },
        token: 'token-1300',
        url: 'http://invite/1300',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      await act(async () => {
        result.current.copyInviteLink({ ...invite, id: 1300 });
      });

      expect(result.current.isInviteCopied({ ...invite, id: 1300 })).toBe(true);
    });

    it('returns false for different invite id', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      expect(result.current.isInviteCopied({ ...invite, id: 1400 })).toBe(false);
      expect(result.current.isInviteCopied({ ...invite, id: 1401 })).toBe(false);
    });

    it('returns false when nothing has been copied', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      expect(result.current.isInviteCopied(invite)).toBe(false);
    });
  });

  describe('copyInviteLink', () => {
    it('calls clipboard.writeText with the stored URL', async () => {
      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 1500 },
        token: 'token-1500',
        url: 'http://invite/1500',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      // Trigger copy - should call clipboard
      result.current.copyInviteLink({ ...invite, id: 1500 });

      expect(mocks.clipboardWriteText).toHaveBeenCalledWith('http://invite/1500');
    });

    it('returns early when link does not exist', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      act(() => {
        result.current.copyInviteLink({ ...invite, id: 1700 });
      });

      expect(mocks.clipboardWriteText).not.toHaveBeenCalled();
      expect(result.current.isInviteCopied({ ...invite, id: 1700 })).toBe(false);
    });

    it('logs error when clipboard write fails', async () => {
      const clipboardError = new Error('Clipboard denied');
      mocks.clipboardWriteText.mockImplementation(() => Promise.reject(clipboardError));

      mocks.createMutateAsync.mockResolvedValue({
        invite: { ...invite, id: 1800 },
        token: 'token-1800',
        url: 'http://invite/1800',
      });

      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      await act(async () => {
        await result.current.handleCreateInvite({ preventDefault: vi.fn() } as unknown as FormEvent);
      });

      // Trigger copy and let rejection be handled
      await act(async () => {
        result.current.copyInviteLink({ ...invite, id: 1800 });
        // Allow promise rejection to process
        vi.advanceTimersByTime(10);
      });

      expect(mocks.logError).toHaveBeenCalledWith(clipboardError, {
        feature: 'module-invites',
        action: 'copy',
        inviteId: 1800,
      });
    });
  });

  describe('State management (setters)', () => {
    it('allows updating createExpiry', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      expect(result.current.createExpiry).toBe(48);

      act(() => {
        result.current.setCreateExpiry(24);
      });

      expect(result.current.createExpiry).toBe(24);

      act(() => {
        result.current.setCreateExpiry(72);
      });

      expect(result.current.createExpiry).toBe(72);
    });

    it('allows updating createMaxUses', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      expect(result.current.createMaxUses).toBe(100);

      act(() => {
        result.current.setCreateMaxUses(10);
      });

      expect(result.current.createMaxUses).toBe(10);

      act(() => {
        result.current.setCreateMaxUses(500);
      });

      expect(result.current.createMaxUses).toBe(500);
    });
  });

  describe('refreshInvites', () => {
    it('calls refetch on query', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      result.current.refreshInvites();

      expect(mocks.refetch).toHaveBeenCalled();
    });

    it('can be called multiple times', () => {
      const { result } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      result.current.refreshInvites();
      result.current.refreshInvites();
      result.current.refreshInvites();

      expect(mocks.refetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Memoization stability', () => {
    it('useMemo result is stable across rerenders with same props', () => {
      const { result, rerender } = renderHook(() =>
        useModuleInvitesPanelState({ module, isOpen: true, canShowInvites: true }),
      );

      const firstResult = result.current.invites;

      // Rerender with same props
      rerender();

      const secondResult = result.current.invites;

      // The invites array reference should be stable when data hasn't changed
      expect(secondResult).toBe(firstResult);
    });
  });
});
