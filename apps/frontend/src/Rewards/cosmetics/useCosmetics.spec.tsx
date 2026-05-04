// Locks the useCosmetics facade: anonymous fallbacks, sanitize-on-read, and mutation forwarding.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { AuthResponse, AuthUser } from '@scholarxp/api-contracts';
import { COSMETIC_DEFAULTS } from '@scholarxp/progression';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/shared/hooks/query-keys';
import { useCosmetics } from '@/Rewards/cosmetics/useCosmetics';

const apiMocks = vi.hoisted(() => ({
  putEquippedCosmetic: vi.fn(),
}));

vi.mock('@/Rewards/RewardsPage/api/rewards', () => ({
  putEquippedCosmetic: apiMocks.putEquippedCosmetic,
}));

// Mock useAuth directly so we don't need to bootstrap the full AuthProvider (which runs a timezone sync effect
// and a /auth/me fetch that add noise to unit tests of this facade hook).
const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: authMocks.useAuth,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function buildStudentUser(
  overrides: Partial<NonNullable<AuthUser['avatar']>> = {},
): AuthUser {
  return {
    id: 42,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    profilePictureUrl: 'https://example.com/avatar.png',
    globalRole: 'student',
    isVerified: true,
    timezone: 'UTC',
    avatar: {
      id: 7,
      totalExp: 2000,
      level: 20,
      currentLevelExp: 100,
      nextLevelExpRequired: 300,
      xpToNextLevel: 200,
      progressPercent: 33,
      equippedCosmetics: { theme: 'dark' },
      ...overrides,
    },
  };
}

describe('useCosmetics', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    apiMocks.putEquippedCosmetic.mockReset();
    authMocks.useAuth.mockReset();
  });

  it('returns default ids for every slot when there is no authenticated user', () => {
    authMocks.useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useCosmetics(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.level).toBe(1);
    for (const [slot, defaultId] of Object.entries(COSMETIC_DEFAULTS)) {
      expect(result.current.cosmetic(slot as never)).toBe(defaultId);
    }
  });

  it('returns the sanitized blob when the student has equipped selections', () => {
    authMocks.useAuth.mockReturnValue({ user: buildStudentUser() });

    const { result } = renderHook(() => useCosmetics(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.level).toBe(20);
    expect(result.current.cosmetic('theme')).toBe('dark');
    // Untouched slots still report defaults so UI components never see undefined.
    expect(result.current.cosmetic('userBadge')).toBe('standard');
  });

  it('falls back to default when a stored selection exceeds the current level', () => {
    // Equipping celestial requires level 90 — at level 20 it must be dropped on read.
    authMocks.useAuth.mockReturnValue({
      user: buildStudentUser({ equippedCosmetics: { theme: 'celestial' } }),
    });

    const { result } = renderHook(() => useCosmetics(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.cosmetic('theme')).toBe('light');
  });

  it('forwards equip calls to the mutation API and updates the auth cache', async () => {
    // Seed both the mocked useAuth return value AND the auth cache, since the mutation's onSuccess
    // writes into the cache via setQueryData — we assert on that downstream update.
    const user = buildStudentUser();
    authMocks.useAuth.mockReturnValue({ user });
    queryClient.setQueryData<AuthResponse>(queryKeys.auth.me, { user });
    apiMocks.putEquippedCosmetic.mockResolvedValue({
      equippedCosmetics: { theme: 'aurora' },
    });

    const { result } = renderHook(() => useCosmetics(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.equipCosmetic('theme', 'aurora');
    });

    expect(apiMocks.putEquippedCosmetic).toHaveBeenCalledWith(
      { slot: 'theme', rewardId: 'aurora' },
      expect.any(Object),
    );

    const cache = queryClient.getQueryData<AuthResponse>(queryKeys.auth.me);
    expect(cache?.user?.avatar?.equippedCosmetics.theme).toBe('aurora');
  });
});
