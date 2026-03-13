// Tests quest query hooks to ensure cache keys and data selectors correctly derive quest progress.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QuestTypeValues, type QuestHistoryResponse } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  partitionQuestViewsByTier,
  useRecordCompletedUnitReviewQuestProgressMutation,
  useRecordDailyRevisionQuestProgressMutation,
  useQuestHistoryInfiniteQuery,
  useTodayQuestListQuery,
  useTodayQuestSummaryQuery,
} from './useQuestsQueries';

const apiMocks = vi.hoisted(() => ({
  listQuests: vi.fn(),
  recordDailyRevisionQuestProgress: vi.fn(),
  recordCompletedUnitReviewQuestProgress: vi.fn(),
}));

vi.mock('../../api/quests', () => ({
  listQuests: apiMocks.listQuests,
  recordDailyRevisionQuestProgress: apiMocks.recordDailyRevisionQuestProgress,
  recordCompletedUnitReviewQuestProgress:
    apiMocks.recordCompletedUnitReviewQuestProgress,
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
  {
    id: 4,
    moduleId: null,
    moduleUnitId: null,
    moduleTitle: 'Master quest',
    moduleUnitTitle: null,
    type: QuestTypeValues.masterDailyQuests,
    tier: 'master',
    expGranted: 250,
    isCompleted: false,
    progressCurrent: 1,
    progressTarget: 3,
    description: 'Complete all 3 daily quests to unlock the master quest reward.',
    questDateUtc: TODAY_STR,
    generatedAt: `${TODAY_STR}T00:00:00.000Z`,
    completedAt: null,
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
    apiMocks.recordDailyRevisionQuestProgress.mockReset();
    apiMocks.recordCompletedUnitReviewQuestProgress.mockReset();
  });

  it('partitions daily quests away from the master quest', () => {
    const result = partitionQuestViewsByTier(mockQuests as never);

    expect(result.dailyQuests).toHaveLength(3);
    expect(result.masterQuest?.type).toBe(QuestTypeValues.masterDailyQuests);
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

      // TODAY_STR has 2 visible daily quests, 1 completed. The master quest does not count toward the summary chip.
      expect(result.current.data).toEqual({
        completed: 1,
        total: 2,
        max: 2,
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
      // Add more daily quests to test slicing while preserving the master quest separately.
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

      // Should have only 3 visible daily quests from today; the master quest is exposed separately.
      expect(result.current.data?.quests).toHaveLength(3);
      expect(result.current.data?.max).toBe(3);
      expect(result.current.data?.quests.every(q => q.questDateUtc === TODAY_STR)).toBe(true);
      expect(result.current.data?.masterQuest?.type).toBe(
        QuestTypeValues.masterDailyQuests,
      );
      
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
      expect(result.current.data?.max).toBe(3);
      expect(result.current.data?.completed).toBe(0);
      expect(result.current.data?.masterQuest).toBeNull();
    });
  });

  describe('quest progress mutations', () => {
    it('records daily revision progress and invalidates quest/auth caches', async () => {
      const invalidateQueries = vi
        .spyOn(queryClient, 'invalidateQueries')
        .mockResolvedValue(undefined);
      apiMocks.recordDailyRevisionQuestProgress.mockResolvedValue({
        recorded: true,
      });

      const { result } = renderHook(
        () => useRecordDailyRevisionQuestProgressMutation(12),
        {
          wrapper: createWrapper(queryClient),
        },
      );

      await result.current.mutateAsync();

      expect(apiMocks.recordDailyRevisionQuestProgress).toHaveBeenCalledWith(12);
      expect(invalidateQueries).toHaveBeenCalledTimes(2);
    });

    it('records completed-unit review progress and invalidates quest/auth caches', async () => {
      const invalidateQueries = vi
        .spyOn(queryClient, 'invalidateQueries')
        .mockResolvedValue(undefined);
      apiMocks.recordCompletedUnitReviewQuestProgress.mockResolvedValue({
        recorded: true,
      });

      const { result } = renderHook(
        () => useRecordCompletedUnitReviewQuestProgressMutation(12),
        {
          wrapper: createWrapper(queryClient),
        },
      );

      await result.current.mutateAsync(44);

      expect(apiMocks.recordCompletedUnitReviewQuestProgress).toHaveBeenCalledWith(
        12,
        44,
      );
      expect(invalidateQueries).toHaveBeenCalledTimes(2);
    });
  });
});
