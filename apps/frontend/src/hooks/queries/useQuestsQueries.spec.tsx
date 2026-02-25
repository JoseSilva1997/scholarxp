// Tests quest query hooks to ensure cache keys and data selectors correctly derive quest progress.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QuestTypeValues, type QuestHistoryResponse } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useQuestHistoryInfiniteQuery,
  useTodayQuestListQuery,
  useTodayQuestSummaryQuery,
} from './useQuestsQueries';

const apiMocks = vi.hoisted(() => ({
  listQuests: vi.fn(),
}));

vi.mock('../../api/quests', () => ({
  listQuests: apiMocks.listQuests,
}));

const TODAY_STR = new Date().toISOString().slice(0, 10);
const YESTERDAY_STR = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const mockQuests = [
  {
    id: 1,
    moduleId: 1,
    moduleTitle: 'Biology',
    type: QuestTypeValues.completeDailyPractice,
    expGranted: 10,
    isCompleted: true,
    questDateUtc: TODAY_STR,
  },
  {
    id: 2,
    moduleId: 2,
    moduleTitle: 'Chemistry',
    type: QuestTypeValues.completeDailyPractice,
    expGranted: 10,
    isCompleted: false,
    questDateUtc: TODAY_STR,
  },
  {
    id: 3,
    moduleId: 3,
    moduleTitle: 'Physics',
    type: QuestTypeValues.completeDailyPractice,
    expGranted: 10,
    isCompleted: true,
    questDateUtc: YESTERDAY_STR,
  },
];

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useQuestsQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    apiMocks.listQuests.mockReset();
  });

  describe('useQuestHistoryInfiniteQuery', () => {
    it('fetches history with initial page param and handles next page transition', async () => {
      apiMocks.listQuests.mockResolvedValue({
        quests: mockQuests,
        hasMore: true,
        nextDayOffset: 7,
      } as QuestHistoryResponse);

      const { result } = renderHook(() => useQuestHistoryInfiniteQuery(true, 14), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiMocks.listQuests).toHaveBeenCalledWith({ dayLimit: 14, dayOffset: 0 });
      expect(result.current.data?.pages[0].nextDayOffset).toBe(7);
    });

    it('remains disabled when enabled flag is false', () => {
      renderHook(() => useQuestHistoryInfiniteQuery(false, 14), {
        wrapper: createWrapper(queryClient),
      });

      expect(apiMocks.listQuests).not.toHaveBeenCalled();
    });
  });

  describe('useTodayQuestSummaryQuery', () => {
    it('derives correct summary stats from history response for the current UTC day', async () => {
      apiMocks.listQuests.mockResolvedValue({
        quests: mockQuests,
        hasMore: false,
        nextDayOffset: null,
      } as QuestHistoryResponse);

      const { result } = renderHook(() => useTodayQuestSummaryQuery(true, 123), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // TODAY_STR has 2 quests, 1 completed
      expect(result.current.data).toEqual({
        completed: 1,
        total: 2,
        max: 3,
      });

      expect(apiMocks.listQuests).toHaveBeenCalledWith({
        dayLimit: 14,
        dayOffset: 0,
      });
    });

    it('works correctly when no userId is provided', async () => {
      apiMocks.listQuests.mockResolvedValue({
        quests: [],
        hasMore: false,
        nextDayOffset: null,
      } as QuestHistoryResponse);

      renderHook(() => useTodayQuestSummaryQuery(true), {
        wrapper: createWrapper(queryClient),
      });

      expect(apiMocks.listQuests).toHaveBeenCalled();
    });
  });

  describe('useTodayQuestListQuery', () => {
    it('filters and limits quests to today only', async () => {
      // Add more quests to test slicing
      const manyQuests = [
        ...mockQuests,
        { ...mockQuests[0], id: 10, questDateUtc: TODAY_STR },
        { ...mockQuests[0], id: 11, questDateUtc: TODAY_STR },
      ];
      apiMocks.listQuests.mockResolvedValue({
        quests: manyQuests,
        hasMore: false,
        nextDayOffset: null,
      } as QuestHistoryResponse);

      const { result } = renderHook(() => useTodayQuestListQuery(true), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should have only 3 quests from today (slice 0, 3)
      expect(result.current.data?.quests).toHaveLength(3);
      expect(result.current.data?.quests.every(q => q.questDateUtc === TODAY_STR)).toBe(true);
      
      // Calculate completed among those 3.
      // initial mockQuests[0] is completed, mockQuests[1] is not, id 10 is completed.
      expect(result.current.data?.completed).toBe(2);
    });

    it('returns empty list if no quests match today', async () => {
      apiMocks.listQuests.mockResolvedValue({
        quests: [mockQuests[2]], // Only yesterday
        hasMore: false,
        nextDayOffset: null,
      } as QuestHistoryResponse);

      const { result } = renderHook(() => useTodayQuestListQuery(true), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.quests).toHaveLength(0);
      expect(result.current.data?.completed).toBe(0);
    });
  });
});
