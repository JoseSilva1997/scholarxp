// Verifies forgot-password page state validates email and maps backend outcomes to user-facing status.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useForgotPasswordPageState } from '@/Auth/ForgotPassword/page-state/useForgotPasswordPageState';
import { useForgotPasswordMutation } from '@/Auth/queries/useAuthMutations';

vi.mock('@/Auth/queries/useAuthMutations', () => ({
  useForgotPasswordMutation: vi.fn(),
}));

function changeEvent(value: string) {
  return { target: { value } } as React.ChangeEvent<HTMLInputElement>;
}

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent;
}

describe('useForgotPasswordPageState', () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useForgotPasswordMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
  });

  it('rejects invalid email addresses before submitting', async () => {
    const { result } = renderHook(() => useForgotPasswordPageState());

    act(() => {
      result.current.handleChange(changeEvent('not-email'));
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.error).toBe('Enter a valid email address.');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('submits a normalized email and marks the reset link as sent', async () => {
    mutateAsync.mockResolvedValue({ sent: true });
    const { result } = renderHook(() => useForgotPasswordPageState());

    act(() => {
      result.current.handleChange(changeEvent(' ADA@Example.COM '));
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mutateAsync).toHaveBeenCalledWith('ada@example.com');
    expect(result.current.status).toBe('sent');
    expect(result.current.error).toBeNull();
  });

  it('shows the OAuth-only account hint and resets status when email changes', async () => {
    mutateAsync.mockResolvedValue({ sent: false, reason: 'no_password' });
    const { result } = renderHook(() => useForgotPasswordPageState());

    act(() => {
      result.current.handleChange(changeEvent('ada@example.com'));
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.status).toBe('no_password');

    act(() => {
      result.current.handleChange(changeEvent('new@example.com'));
    });

    expect(result.current.status).toBe('idle');
  });

  it('surfaces mutation errors through the display error helper', async () => {
    mutateAsync.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useForgotPasswordPageState());

    act(() => {
      result.current.handleChange(changeEvent('ada@example.com'));
    });
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.error).toBe('Unable to send reset link right now.');
  });
});
