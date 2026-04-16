// Locks the cosmetic equip mutation against its cache-update contract so every auth-reading component re-renders on success.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { AuthResponse } from '@scholarxp/api-contracts';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query-keys';
import { useEquipCosmeticMutation } from './useCosmeticsQueries';

const apiMocks = vi.hoisted(() => ({
  putEquippedCosmetic: vi.fn(),
}));

vi.mock('@/api/rewards', () => ({
  putEquippedCosmetic: apiMocks.putEquippedCosmetic,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// Minimal fixture — AccountProgress is wide, so we only include the fields the mutation touches or preserves.
function seedAuthCache(queryClient: QueryClient) {
  const initial: AuthResponse = {
    user: {
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
        totalExp: 1000,
        level: 10,
        currentLevelExp: 50,
        nextLevelExpRequired: 200,
        xpToNextLevel: 150,
        progressPercent: 25,
        equippedCosmetics: { theme: 'light', userBadge: 'standard' },
      },
    },
  };
  queryClient.setQueryData(queryKeys.auth.me, initial);
  return initial;
}

describe('useEquipCosmeticMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // gcTime stays at the default because the test reads setQueryData values without an active observer;
    // setting it to 0 would garbage-collect the cached auth entry before assertions run.
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    apiMocks.putEquippedCosmetic.mockReset();
  });

  it('forwards the payload to the rewards api helper', async () => {
    seedAuthCache(queryClient);
    apiMocks.putEquippedCosmetic.mockResolvedValue({
      equippedCosmetics: { theme: 'dark', userBadge: 'standard' },
    });

    const { result } = renderHook(() => useEquipCosmeticMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slot: 'theme', rewardId: 'dark' });
    });

    // TanStack Query v5 passes an internal context object as the second argument to mutationFn;
    // we only care that the payload shape is forwarded unchanged.
    expect(apiMocks.putEquippedCosmetic).toHaveBeenCalledWith(
      { slot: 'theme', rewardId: 'dark' },
      expect.any(Object),
    );
  });

  it('merges the server response into the auth cache so consumers re-render', async () => {
    seedAuthCache(queryClient);
    apiMocks.putEquippedCosmetic.mockResolvedValue({
      equippedCosmetics: { theme: 'dark', userBadge: 'silver' },
    });

    const { result } = renderHook(() => useEquipCosmeticMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slot: 'userBadge', rewardId: 'silver' });
    });

    const cache = queryClient.getQueryData<AuthResponse>(queryKeys.auth.me);
    expect(cache?.user?.avatar?.equippedCosmetics).toEqual({
      theme: 'dark',
      userBadge: 'silver',
    });
    // Other avatar fields must survive — the mutation replaces only the equipped slice.
    expect(cache?.user?.avatar?.totalExp).toBe(1000);
    expect(cache?.user?.avatar?.level).toBe(10);
  });

  it('leaves the cache untouched when there is no avatar on the user', async () => {
    const tutorResponse: AuthResponse = {
      user: {
        id: 9,
        firstName: 'Tim',
        lastName: 'Berners',
        email: 'tim@example.com',
        profilePictureUrl: 'https://example.com/tim.png',
        globalRole: 'teacher',
        isVerified: true,
        timezone: 'UTC',
        avatar: null,
      },
    };
    queryClient.setQueryData(queryKeys.auth.me, tutorResponse);
    apiMocks.putEquippedCosmetic.mockResolvedValue({
      equippedCosmetics: { theme: 'dark' },
    });

    const { result } = renderHook(() => useEquipCosmeticMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ slot: 'theme', rewardId: 'dark' });
    });

    // Avatar is still null; we don't invent one just because a mutation succeeded.
    const cache = queryClient.getQueryData<AuthResponse>(queryKeys.auth.me);
    expect(cache?.user?.avatar).toBeNull();
  });
});
