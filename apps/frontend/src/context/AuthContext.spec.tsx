// Verifies auth provider cache actions, logout side effects, timezone sync, and hook guard.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AuthUser } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { queryKeys } from '@/shared/hooks/query-keys';

const authApiMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}));
const userApiMocks = vi.hoisted(() => ({
  updateTimezone: vi.fn(),
}));
const clientMocks = vi.hoisted(() => ({
  clearCsrfToken: vi.fn(),
  refreshCsrfToken: vi.fn(),
}));
const loggerMocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock('@/Auth/api/auth', () => ({
  getCurrentUser: authApiMocks.getCurrentUser,
  logout: authApiMocks.logout,
}));

vi.mock('@/Account/api/users', () => ({
  updateTimezone: userApiMocks.updateTimezone,
}));

vi.mock('@/shared/api/client', () => ({
  clearCsrfToken: clientMocks.clearCsrfToken,
  refreshCsrfToken: clientMocks.refreshCsrfToken,
}));

vi.mock('@/utils/logger', () => ({
  logError: loggerMocks.logError,
}));

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 7,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    profilePictureUrl: '',
    globalRole: 'student',
    isVerified: true,
    timezone: 'UTC',
    avatar: {
      id: 1,
      totalExp: 100,
      level: 2,
      currentLevelExp: 0,
      nextLevelExpRequired: 100,
      xpToNextLevel: 100,
      progressPercent: 0,
      equippedCosmetics: {},
    },
    ...overrides,
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Providers({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function AuthProbe() {
  const { user, setUser, applyStudentExpReward, refreshUser, logout, isLoading } = useAuth();
  return (
    <>
      <div data-testid="name">{user ? user.firstName : 'anonymous'}</div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="exp">{String(user?.avatar?.totalExp ?? 0)}</div>
      <button type="button" onClick={() => setUser(buildUser({ firstName: 'Grace' }))}>set</button>
      <button type="button" onClick={() => applyStudentExpReward(50)}>reward</button>
      <button type="button" onClick={() => void refreshUser()}>refresh</button>
      <button type="button" onClick={() => void logout()}>logout</button>
    </>
  );
}

function BrokenProbe() {
  useAuth();
  return null;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApiMocks.getCurrentUser.mockResolvedValue({ user: buildUser() });
    authApiMocks.logout.mockResolvedValue({ ok: true });
    userApiMocks.updateTimezone.mockResolvedValue(buildUser({ timezone: 'Europe/London' }));
    clientMocks.refreshCsrfToken.mockResolvedValue(undefined);
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/London' }),
    } as never);
  });

  it('loads current user, syncs timezone, updates cache user, and applies student XP rewards', async () => {
    const queryClient = createClient();
    render(
      <Providers queryClient={queryClient}>
        <AuthProbe />
      </Providers>,
    );

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Ada'));
    await waitFor(() => expect(userApiMocks.updateTimezone).toHaveBeenCalledWith(7, 'Europe/London'));
    await waitFor(() =>
      expect(queryClient.getQueryData<{ user: AuthUser | null }>(queryKeys.auth.me)?.user?.timezone)
        .toBe('Europe/London'),
    );

    act(() => screen.getByRole('button', { name: 'set' }).click());
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Grace'));

    act(() => screen.getByRole('button', { name: 'reward' }).click());
    await waitFor(() => expect(screen.getByTestId('exp')).toHaveTextContent('150'));
  });

  it('refreshes to anonymous on refetch errors and logs the failure', async () => {
    const queryClient = createClient();
    authApiMocks.getCurrentUser.mockResolvedValueOnce({ user: buildUser() });
    render(
      <Providers queryClient={queryClient}>
        <AuthProbe />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Ada'));

    authApiMocks.getCurrentUser.mockRejectedValueOnce(new Error('unauthorized'));
    await act(async () => {
      screen.getByRole('button', { name: 'refresh' }).click();
    });

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('anonymous'));
    expect(loggerMocks.logError).toHaveBeenCalledWith(expect.any(Error), {
      source: 'AuthContext.refreshUser',
    });
  });

  it('logs out locally, clears module cache, and refreshes csrf even if backend logout fails', async () => {
    const queryClient = createClient();
    authApiMocks.logout.mockRejectedValueOnce(new Error('logout failed'));
    render(
      <Providers queryClient={queryClient}>
        <AuthProbe />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Ada'));
    queryClient.setQueryData(['modules'], ['cached']);

    await act(async () => {
      screen.getByRole('button', { name: 'logout' }).click();
    });

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('anonymous'));
    expect(queryClient.getQueryData(['modules'])).toBeUndefined();
    expect(clientMocks.clearCsrfToken).toHaveBeenCalled();
    expect(clientMocks.refreshCsrfToken).toHaveBeenCalled();
    expect(loggerMocks.logError).toHaveBeenCalledWith(expect.any(Error), {
      source: 'AuthContext.logout',
    });
  });

  it('ignores non-positive or ineligible XP rewards and handles successful logout responses', async () => {
    authApiMocks.getCurrentUser.mockResolvedValue({
      user: buildUser({ globalRole: 'teacher', avatar: null, timezone: 'Europe/London' }),
    });
    authApiMocks.logout.mockResolvedValueOnce({ ok: true, csrfToken: 'server-token' });
    const queryClient = createClient();
    render(
      <Providers queryClient={queryClient}>
        <AuthProbe />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Ada'));

    act(() => screen.getByRole('button', { name: 'reward' }).click());
    expect(screen.getByTestId('exp')).toHaveTextContent('0');

    await act(async () => {
      screen.getByRole('button', { name: 'logout' }).click();
    });

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('anonymous'));
    expect(clientMocks.clearCsrfToken).toHaveBeenCalled();
    expect(clientMocks.refreshCsrfToken).toHaveBeenCalled();
  });

  it('throws when useAuth is used outside the provider', () => {
    expect(() => render(<BrokenProbe />)).toThrow('useAuth must be used within an AuthProvider');
  });
});
