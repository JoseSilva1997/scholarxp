// Verifies reset-password page state validates tokens/passwords and handles server responses.
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/Auth/api/auth';
import { useResetPasswordPageState } from '@/Auth/ForgotPassword/page-state/useResetPasswordPageState';
import { useResetPasswordMutation } from '@/Auth/queries/useAuthMutations';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/Auth/queries/useAuthMutations', () => ({
  useResetPasswordMutation: vi.fn(),
}));

function wrapper(route: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;
  };
}

function inputEvent(name: string, value: string) {
  return { target: { name, value } } as React.ChangeEvent<HTMLInputElement>;
}

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent;
}

describe('useResetPasswordPageState', () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useResetPasswordMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
  });

  it('detects a missing token and weak password before submitting', async () => {
    const { result } = renderHook(() => useResetPasswordPageState(), {
      wrapper: wrapper('/reset-password'),
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.hasToken).toBe(false);
    expect(result.current.errors).toContain(
      'Reset link is missing or invalid. Request a new link from the forgot-password page.',
    );
    expect(result.current.errors).toContain('Password must be at least 10 characters.');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('tracks password strength and navigates to login after a successful reset', async () => {
    mutateAsync.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useResetPasswordPageState(), {
      wrapper: wrapper('/reset-password?token= token-123 '),
    });

    act(() => {
      result.current.handlePasswordChange(inputEvent('password', 'Validpass1!'));
      result.current.handlePasswordChange(inputEvent('confirmPassword', 'Validpass1!'));
      result.current.setShowMeter(true);
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.token).toBe('token-123');
    expect(result.current.strengthLabel).toBe('Excellent');
    expect(mutateAsync).toHaveBeenCalledWith({
      token: 'token-123',
      password: 'Validpass1!',
    });
    expect(navigateMock).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { message: 'Password reset. Log in with your new password.' },
    });
  });

  it('reports policy and confirmation validation errors', async () => {
    const { result } = renderHook(() => useResetPasswordPageState(), {
      wrapper: wrapper('/reset-password?token=abc'),
    });

    act(() => {
      result.current.handlePasswordChange(inputEvent('password', 'longpassword'));
      result.current.handlePasswordChange(inputEvent('confirmPassword', 'different'));
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.errors).toEqual([
      'Password must include uppercase, lowercase, number, and symbol characters.',
      'Passwords do not match.',
    ]);
  });

  it('uses ApiError details and fallback messages from server failures', async () => {
    mutateAsync.mockRejectedValueOnce(
      new ApiError({
        message: 'Validation failed',
        status: 400,
        code: 'VALIDATION',
        data: {},
        details: [{ field: 'password', message: 'Password was used before.' }],
      }),
    );
    const { result } = renderHook(() => useResetPasswordPageState(), {
      wrapper: wrapper('/reset-password?token=abc'),
    });

    act(() => {
      result.current.handlePasswordChange(inputEvent('password', 'Validpass1!'));
      result.current.handlePasswordChange(inputEvent('confirmPassword', 'Validpass1!'));
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.errors).toEqual(['Password was used before.']);

    mutateAsync.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.error).toBe('Something went wrong. Please try again.');
  });
});
