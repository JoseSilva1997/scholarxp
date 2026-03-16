// Reward query tests verify the standalone header reward track uses the expected cache keys and enablement rules.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { DailyLessonXpTrackResponse } from '@scholarxp/api-contracts';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query-keys';
import { useDailyLessonXpTrackQuery } from './useRewardsQueries';

const apiMocks = vi.hoisted(() => ({
  getDailyLessonXpTrack: vi.fn(),
}));

vi.mock('@/api/rewards', () => ({
  getDailyLessonXpTrack: apiMocks.getDailyLessonXpTrack,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useRewardsQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    apiMocks.getDailyLessonXpTrack.mockReset();
  });

  it('fetches the daily lesson XP track with the dedicated reward cache key', async () => {
    const response: DailyLessonXpTrackResponse = {
      dayKeyUtc: '2026-03-15',
      completedLessonsToday: 1,
      nextRewardXp: 25,
      resetsAtUtc: '2026-03-16T00:00:00.000Z',
      steps: [
        { key: 'first_completion', rewardXp: 100, state: 'earned' },
        { key: 'second_completion', rewardXp: 25, state: 'active' },
        { key: 'practice', rewardXp: 0, state: 'upcoming' },
      ],
    };
    apiMocks.getDailyLessonXpTrack.mockResolvedValue(response);

    const { result } = renderHook(() => useDailyLessonXpTrackQuery(true, 55), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(response);
    expect(queryClient.getQueryState(queryKeys.rewards.dailyLessonXpTrack(55))).toBeTruthy();
    expect(apiMocks.getDailyLessonXpTrack).toHaveBeenCalledTimes(1);
  });

  it('stays disabled when the query is not enabled yet', () => {
    renderHook(() => useDailyLessonXpTrackQuery(false, 55), {
      wrapper: createWrapper(queryClient),
    });

    expect(apiMocks.getDailyLessonXpTrack).not.toHaveBeenCalled();
  });
});
