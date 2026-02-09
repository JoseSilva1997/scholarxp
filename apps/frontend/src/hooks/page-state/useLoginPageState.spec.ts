// Verifies login page-state orchestration so auth flow branching stays stable and user-safe.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Location } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginPageState } from './useLoginPageState';

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  setUserMock: vi.fn(),
  mutateAsyncMock: vi.fn(),
  ensureCsrfTokenMock: vi.fn(),
  clearCsrfTokenMock: vi.fn(),
  getDisplayErrorMessageMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

let mockLocation: Partial<Location> & { state?: unknown } = {
  pathname: '/login',
  search: '',
  hash: '',
  state: null,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigateMock,
    useLocation: () => mockLocation,
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    setUser: mocks.setUserMock,
  }),
}));

vi.mock('../queries/useAuthMutations', () => ({
  useLoginMutation: () => ({
    mutateAsync: mocks.mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock('../../api/client', () => ({
  ensureCsrfToken: mocks.ensureCsrfTokenMock,
  clearCsrfToken: mocks.clearCsrfTokenMock,
}));

vi.mock('../../api/get-display-error', () => ({
  getDisplayErrorMessage: mocks.getDisplayErrorMessageMock,
}));

vi.mock('../../utils/logger', () => ({
  logError: mocks.logErrorMock,
}));

describe('useLoginPageState', () => {
  beforeEach(() => {
    mocks.navigateMock.mockReset();
    mocks.setUserMock.mockReset();
    mocks.mutateAsyncMock.mockReset();
    mocks.ensureCsrfTokenMock.mockReset();
    mocks.clearCsrfTokenMock.mockReset();
    mocks.getDisplayErrorMessageMock.mockReset();
    mocks.logErrorMock.mockReset();
    sessionStorage.clear();
    mockLocation = {
      pathname: '/login',
      search: '',
      hash: '',
      state: null,
    };
    mocks.ensureCsrfTokenMock.mockResolvedValue(undefined);
  });

  it('stores redirect target for post-auth flows when location state includes from', async () => {
    mockLocation = {
      pathname: '/login',
      search: '',
      hash: '',
      state: {
        from: {
          pathname: '/main/invites',
          search: '?invite=abc',
          hash: '#details',
        },
      },
    };

    renderHook(() => useLoginPageState());

    await waitFor(() => {
      expect(sessionStorage.getItem('postAuthRedirect')).toBe('/main/invites?invite=abc#details');
    });
  });

  it('submits trimmed credentials and navigates to redirect destination for verified users', async () => {
    mockLocation = {
      pathname: '/login',
      search: '',
      hash: '',
      state: {
        from: {
          pathname: '/main/modules/42',
          search: '?tab=overview',
          hash: '#content',
        },
      },
    };

    mocks.mutateAsyncMock.mockResolvedValue({
      user: {
        id: 7,
        email: 'student@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'STUDENT',
        isVerified: true,
        requiresEmailVerification: false,
      },
    });

    const { result } = renderHook(() => useLoginPageState());

    act(() => {
      result.current.handleChange({ target: { name: 'email', value: '  STUDENT@example.com  ' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'password', value: 'secret-pass' } } as ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mocks.clearCsrfTokenMock).toHaveBeenCalledTimes(1);
    expect(mocks.ensureCsrfTokenMock).toHaveBeenCalledTimes(2);
    expect(mocks.mutateAsyncMock).toHaveBeenCalledWith({
      email: 'STUDENT@example.com',
      password: 'secret-pass',
    });
    expect(mocks.setUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        email: 'student@example.com',
      }),
    );
    expect(mocks.navigateMock).toHaveBeenCalledWith('/main/modules/42?tab=overview#content', {
      replace: true,
    });
    expect(sessionStorage.getItem('postAuthRedirect')).toBeNull();
  });

  it('redirects to verify-email when backend indicates unverified account after login', async () => {
    mocks.mutateAsyncMock.mockResolvedValue({
      user: {
        id: 9,
        email: 'verify@school.edu',
        firstName: 'Una',
        lastName: 'Verified',
        role: 'STUDENT',
        isVerified: false,
        requiresEmailVerification: true,
      },
    });

    const { result } = renderHook(() => useLoginPageState());

    act(() => {
      result.current.handleChange({ target: { name: 'email', value: ' Verify@School.edu ' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'password', value: 'secret-pass' } } as ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mocks.setUserMock).not.toHaveBeenCalled();
    expect(mocks.navigateMock).toHaveBeenCalledWith('/verify-email', {
      replace: true,
      state: { email: 'verify@school.edu' },
    });
  });

  it('uses display error copy and navigates to verify-email when error message requests verification', async () => {
    mocks.mutateAsyncMock.mockRejectedValue(new Error('401'));
    mocks.getDisplayErrorMessageMock.mockReturnValue('Account not verified. Please verify your email.');

    const { result } = renderHook(() => useLoginPageState());

    act(() => {
      result.current.handleChange({ target: { name: 'email', value: ' VerifyMe@School.edu ' } } as ChangeEvent<HTMLInputElement>);
      result.current.handleChange({ target: { name: 'password', value: 'secret-pass' } } as ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mocks.getDisplayErrorMessageMock).toHaveBeenCalledWith(
      expect.any(Error),
      { fallbackMessage: 'Something went wrong. Please try again.' },
    );
    expect(result.current.error).toBe('Account not verified. Please verify your email.');
    expect(mocks.navigateMock).toHaveBeenCalledWith('/verify-email', {
      replace: false,
      state: {
        email: 'verifyme@school.edu',
        message: 'Account not verified. Please verify your email.',
      },
    });
  });
});
