// Exercises register page-state behavior so validation, submission shaping, and API error handling stay reliable.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/auth';
import { useRegisterPageState } from './useRegisterPageState';

const navigateMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../queries/useAuthMutations', () => ({
  useRegisterByEmailMutation: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe('useRegisterPageState', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mutateAsyncMock.mockReset();
  });

  it('surfaces validation issues and blocks submission when form is invalid', async () => {
    const { result } = renderHook(() => useRegisterPageState());

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(result.current.errors).toContain('First name is required.');
    expect(result.current.errors).toContain('Last name is required.');
    expect(result.current.errors).toContain('Email is required.');
  });

  it('submits trimmed payload and redirects to verify-email on success', async () => {
    mutateAsyncMock.mockResolvedValue({});
    const { result } = renderHook(() => useRegisterPageState());

    act(() => {
      result.current.handleChange({ target: { name: 'firstName', value: '  Jane  ' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'lastName', value: '  Doe  ' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'email', value: '  STUDENT@EXAMPLE.COM  ' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'password', value: 'Abcdef!234' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef!234' } } as ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'student@example.com',
      password: 'Abcdef!234',
    });
    expect(navigateMock).toHaveBeenCalledWith('/verify-email', {
      replace: true,
      state: { email: 'student@example.com' },
    });
  });

  it('prefers ApiError detail messages when backend validation fails', async () => {
    // Use API details directly because this matches the backend-owned validation UX path.
    mutateAsyncMock.mockRejectedValue(
      new ApiError({
        message: 'Validation failed',
        status: 422,
        code: 'UNPROCESSABLE_ENTITY',
        data: { message: ['ignored fallback'] },
        details: [{ message: 'Email already exists.' }],
      }),
    );

    const { result } = renderHook(() => useRegisterPageState());

    act(() => {
      result.current.handleChange({ target: { name: 'firstName', value: 'Jane' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'lastName', value: 'Doe' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'email', value: 'student@example.com' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'password', value: 'Abcdef!234' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'confirmPassword', value: 'Abcdef!234' } } as ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    await waitFor(() => {
      expect(result.current.errors).toEqual(['Email already exists.']);
      expect(result.current.error).toBeNull();
    });
  });
});
