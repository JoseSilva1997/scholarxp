// Verifies accept-invite page-state so token handling, logging, and redirects behave correctly.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcceptInvitePageState } from './useAcceptInvitePageState';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  redeemMutate: vi.fn(),
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

vi.mock('../queries/useModuleInvitesQueries', () => ({
  useRedeemInviteMutation: () => ({
    mutate: mocks.redeemMutate,
    ...mutationState,
  }),
}));

vi.mock('../../api/get-display-error', () => ({
  getDisplayErrorMessage: mocks.getDisplayErrorMessage,
  shouldLogApiError: mocks.shouldLogApiError,
}));

vi.mock('../../utils/logger', () => ({
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
    mocks.redeemMutate.mockReset();
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
    expect(mocks.redeemMutate).not.toHaveBeenCalled();
  });

  it('redeems invite once when token exists', () => {
    tokenValue = 'invite-abc';

    const { rerender } = renderHook(() => useAcceptInvitePageState());

    expect(mocks.redeemMutate).toHaveBeenCalledTimes(1);
    expect(mocks.redeemMutate).toHaveBeenCalledWith('invite-abc');

    rerender();
    expect(mocks.redeemMutate).toHaveBeenCalledTimes(1);
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

  it('navigates to module page after successful redemption delay', () => {
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

    expect(mocks.navigate).toHaveBeenCalledWith('/main/modules/42', { replace: true });
  });

  it('exposes goToModules shortcut action', () => {
    const { result } = renderHook(() => useAcceptInvitePageState());

    result.current.goToModules();

    expect(mocks.navigate).toHaveBeenCalledWith('/main/modules');
  });
});
