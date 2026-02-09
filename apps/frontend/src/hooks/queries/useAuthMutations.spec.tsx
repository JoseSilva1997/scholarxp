// Verifies auth mutation hooks delegate to auth API functions with unchanged payloads.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useLoginMutation,
  useRegisterByEmailMutation,
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from './useAuthMutations';

const apiMocks = vi.hoisted(() => ({
  login: vi.fn(),
  registerByEmail: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('../../api/auth', () => ({
  login: apiMocks.login,
  registerByEmail: apiMocks.registerByEmail,
  verifyEmail: apiMocks.verifyEmail,
  resendVerification: apiMocks.resendVerification,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAuthMutations', () => {
  beforeEach(() => {
    apiMocks.login.mockReset();
    apiMocks.registerByEmail.mockReset();
    apiMocks.verifyEmail.mockReset();
    apiMocks.resendVerification.mockReset();
  });

  it('useLoginMutation forwards payload to login api', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    apiMocks.login.mockResolvedValue({ user: { id: 1 } });

    const { result } = renderHook(() => useLoginMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ email: 'jane@example.com', password: 'secret' });
    });

    expect(apiMocks.login).toHaveBeenCalledWith(
      { email: 'jane@example.com', password: 'secret' },
      expect.any(Object),
    );
  });

  it('useRegisterByEmailMutation forwards payload to register api', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    apiMocks.registerByEmail.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useRegisterByEmailMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'Abcdef!234',
      });
    });

    expect(apiMocks.registerByEmail).toHaveBeenCalledWith(
      {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'Abcdef!234',
      },
      expect.any(Object),
    );
  });

  it('useVerifyEmailMutation forwards token to verifyEmail api', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    apiMocks.verifyEmail.mockResolvedValue({ user: { id: 1 } });

    const { result } = renderHook(() => useVerifyEmailMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('token-123');
    });

    expect(apiMocks.verifyEmail).toHaveBeenCalledWith('token-123', expect.any(Object));
  });

  it('useResendVerificationMutation forwards email to resendVerification api', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    apiMocks.resendVerification.mockResolvedValue({ message: 'sent' });

    const { result } = renderHook(() => useResendVerificationMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('jane@example.com');
    });

    expect(apiMocks.resendVerification).toHaveBeenCalledWith('jane@example.com', expect.any(Object));
  });
});
