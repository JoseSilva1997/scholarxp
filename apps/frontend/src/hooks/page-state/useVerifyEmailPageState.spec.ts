// Verifies verify-email page-state logic so verification/resend flows stay deterministic and user-safe.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import type { Location } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVerifyEmailPageState } from './useVerifyEmailPageState';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setUser: vi.fn(),
  verifyMutateAsync: vi.fn(),
  resendMutateAsync: vi.fn(),
  getDisplayErrorMessage: vi.fn(),
}));

let mockLocation: Partial<Location> & { state?: unknown } = {
  pathname: '/verify-email',
  search: '',
  hash: '',
  state: null,
};

let verifyPending = false;
let resendPending = false;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => mockLocation,
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    setUser: mocks.setUser,
  }),
}));

vi.mock('../queries/useAuthMutations', () => ({
  useVerifyEmailMutation: () => ({
    mutateAsync: mocks.verifyMutateAsync,
    isPending: verifyPending,
  }),
  useResendVerificationMutation: () => ({
    mutateAsync: mocks.resendMutateAsync,
    isPending: resendPending,
  }),
}));

vi.mock('../../api/get-display-error', () => ({
  getDisplayErrorMessage: mocks.getDisplayErrorMessage,
}));

describe('useVerifyEmailPageState', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.setUser.mockReset();
    mocks.verifyMutateAsync.mockReset();
    mocks.resendMutateAsync.mockReset();
    mocks.getDisplayErrorMessage.mockReset();

    verifyPending = false;
    resendPending = false;

    mockLocation = {
      pathname: '/verify-email',
      search: '',
      hash: '',
      state: null,
    };
  });

  it('hydrates initial email and message from navigation state', () => {
    mockLocation.state = {
      email: 'student@example.com',
      message: 'Please verify your account.',
    };

    const { result } = renderHook(() => useVerifyEmailPageState());

    expect(result.current.email).toBe('student@example.com');
    expect(result.current.error).toBe('Please verify your account.');
  });

  it('verifies code, sets user, and redirects to /main on success', async () => {
    mocks.verifyMutateAsync.mockResolvedValue({
      user: { id: 5, email: 'student@example.com' },
    });

    const { result } = renderHook(() => useVerifyEmailPageState());

    act(() => {
      result.current.setCode('  code-123  ');
    });

    await act(async () => {
      await result.current.handleVerify({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mocks.verifyMutateAsync).toHaveBeenCalledWith('code-123');
    expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
    expect(mocks.navigate).toHaveBeenCalledWith('/main', { replace: true });
  });

  it('shows invalid-code message when verify succeeds without user', async () => {
    mocks.verifyMutateAsync.mockResolvedValue({ user: null });

    const { result } = renderHook(() => useVerifyEmailPageState());

    await act(async () => {
      await result.current.handleVerify({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(result.current.error).toBe('Invalid or expired code.');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('shows display error message when verification fails', async () => {
    const verifyError = new Error('boom');
    mocks.verifyMutateAsync.mockRejectedValue(verifyError);
    mocks.getDisplayErrorMessage.mockReturnValue('Unable to verify right now.');

    const { result } = renderHook(() => useVerifyEmailPageState());

    await act(async () => {
      await result.current.handleVerify({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mocks.getDisplayErrorMessage).toHaveBeenCalledWith(verifyError, {
      fallbackMessage: 'Unable to verify right now.',
    });
    expect(result.current.error).toBe('Unable to verify right now.');
  });

  it('prevents resend while mutation is already pending', async () => {
    resendPending = true;

    const { result } = renderHook(() => useVerifyEmailPageState());

    await act(async () => {
      await result.current.handleResend();
    });

    expect(mocks.resendMutateAsync).not.toHaveBeenCalled();
  });

  it('requires email before resend', async () => {
    const { result } = renderHook(() => useVerifyEmailPageState());

    await act(async () => {
      await result.current.handleResend();
    });

    expect(result.current.error).toBe('Enter your email to resend a code.');
    expect(mocks.resendMutateAsync).not.toHaveBeenCalled();
  });

  it('sets success info and cooldown after resend', async () => {
    mocks.resendMutateAsync.mockResolvedValue({ alreadyVerified: false });

    const { result } = renderHook(() => useVerifyEmailPageState());

    act(() => {
      result.current.setEmail(' Student@Example.com ');
    });

    await act(async () => {
      await result.current.handleResend();
    });

    expect(mocks.resendMutateAsync).toHaveBeenCalledWith('student@example.com');
    expect(result.current.info).toBe('New code sent. Check your inbox.');
    expect(result.current.cooldown).toBe(30);
  });

  it('surfaces already-verified info when resend reports already verified', async () => {
    mocks.resendMutateAsync.mockResolvedValue({ alreadyVerified: true });

    const { result } = renderHook(() => useVerifyEmailPageState());

    act(() => {
      result.current.setEmail('student@example.com');
    });

    await act(async () => {
      await result.current.handleResend();
    });

    expect(result.current.info).toBe('Already verified—try logging in.');
  });

  it('resets cooldown and shows display error when resend fails', async () => {
    const resendError = new Error('network');
    mocks.resendMutateAsync.mockRejectedValue(resendError);
    mocks.getDisplayErrorMessage.mockReturnValue('Unable to resend right now.');

    const { result } = renderHook(() => useVerifyEmailPageState());

    act(() => {
      result.current.setEmail('student@example.com');
    });

    await act(async () => {
      await result.current.handleResend();
    });

    await waitFor(() => {
      expect(result.current.cooldown).toBe(0);
    });

    expect(mocks.getDisplayErrorMessage).toHaveBeenCalledWith(resendError, {
      fallbackMessage: 'Unable to resend right now.',
    });
    expect(result.current.error).toBe('Unable to resend right now.');
  });
});
