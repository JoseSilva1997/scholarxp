// Verifies accept-invite page-state so token handling, logging, and redirects behave correctly.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcceptInvitePageState } from '@/Authoring/AcceptInvite/page-state/useAcceptInvitePageState';
import { ApiError } from '@/shared/api/client';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getDisplayErrorMessage: vi.fn(),
  shouldLogApiError: vi.fn(),
  logError: vi.fn(),
}));

let tokenValue = '';
let mutationState = {
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null as unknown,
  data: undefined as { moduleId: number } | undefined,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [new URLSearchParams(tokenValue ? `token=${tokenValue}` : '')],
  };
});

vi.mock('@/Authoring/SingleModule/queries/useModuleInvitesQueries', () => ({
  useRedeemInviteQuery: () => ({
    ...mutationState,
  }),
}));

vi.mock('@/shared/api/get-display-error', () => ({
  getDisplayErrorMessage: mocks.getDisplayErrorMessage,
  shouldLogApiError: mocks.shouldLogApiError,
}));

vi.mock('@/utils/logger', () => ({
  logError: mocks.logError,
}));

describe('useAcceptInvitePageState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tokenValue = '';
    mutationState = {
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
    };

    mocks.navigate.mockReset();
    mocks.getDisplayErrorMessage.mockReset();
    mocks.shouldLogApiError.mockReset();
    mocks.logError.mockReset();
    mocks.shouldLogApiError.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles missing token without redeem attempt', () => {
    const { result } = renderHook(() => useAcceptInvitePageState());

    expect(result.current.hasToken).toBe(false);
    expect(result.current.errorMessage).toBe('This invite link is missing a token.');
  });

  it('exposes pending state when a token-backed redeem request is active', () => {
    tokenValue = 'invite-abc';
    mutationState = {
      isPending: true,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
    };

    const { result } = renderHook(() => useAcceptInvitePageState());

    expect(result.current.hasToken).toBe(true);
    expect(result.current.isPending).toBe(true);
  });

  it('logs unexpected redeem errors when logging policy allows it', () => {
    tokenValue = 'invite-abc';
    const redeemError = new Error('boom');
    mutationState = {
      isPending: false,
      isSuccess: false,
      isError: true,
      error: redeemError,
      data: undefined,
    };
    mocks.shouldLogApiError.mockReturnValue(true);
    mocks.getDisplayErrorMessage.mockReturnValue('Redeem failed.');

    const { result } = renderHook(() => useAcceptInvitePageState());

    expect(mocks.logError).toHaveBeenCalledWith(redeemError, {
      feature: 'module-invites',
      action: 'redeem',
    });
    expect(result.current.errorMessage).toBe('Redeem failed.');
  });

  it('does not log redeem errors when logging policy skips expected API errors', () => {
    tokenValue = 'invite-abc';
    const redeemError = new Error('expected');
    mutationState = {
      isPending: false,
      isSuccess: false,
      isError: true,
      error: redeemError,
      data: undefined,
    };
    mocks.shouldLogApiError.mockReturnValue(false);
    mocks.getDisplayErrorMessage.mockReturnValue('Cannot redeem invite.');

    const { result } = renderHook(() => useAcceptInvitePageState());

    expect(mocks.logError).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe('Cannot redeem invite.');
  });

  it('replaces the generic invite permission error with graceful copy', () => {
    tokenValue = 'invite-abc';
    mutationState = {
      isPending: false,
      isSuccess: false,
      isError: true,
      error: new ApiError({
        message: 'Insufficient permissions',
        status: 403,
        code: 'FORBIDDEN',
        data: { message: 'Insufficient permissions' },
      }),
      data: undefined,
    };
    mocks.shouldLogApiError.mockReturnValue(false);

    const { result } = renderHook(() => useAcceptInvitePageState());

    expect(mocks.getDisplayErrorMessage).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe(
      'This invite link can only be used from an eligible student account. If you are a teacher, ask the module owner to share access another way.',
    );
  });

  it('navigates to modules page after successful redemption delay', () => {
    tokenValue = 'invite-abc';
    mutationState = {
      isPending: false,
      isSuccess: true,
      isError: false,
      error: null,
      data: { moduleId: 42 },
    };

    renderHook(() => useAcceptInvitePageState());

    expect(mocks.navigate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(mocks.navigate).toHaveBeenCalledWith('/main/modules', { replace: true });
  });

  it('exposes goToModules shortcut action', () => {
    const { result } = renderHook(() => useAcceptInvitePageState());

    result.current.goToModules();

    expect(mocks.navigate).toHaveBeenCalledWith('/main/modules');
  });
});
