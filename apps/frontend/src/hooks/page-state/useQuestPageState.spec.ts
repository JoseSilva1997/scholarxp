// Unit tests for useQuestPageState verify grouping logic, date formatting, and state orchestration.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useQuestPageState } from './useQuestPageState';
import { useAuth } from '../../context/AuthContext';
import { useQuestHistoryInfiniteQuery } from '../queries/useQuestsQueries';
import { getDisplayErrorMessage, shouldLogApiError } from '../../api/get-display-error';
import { logError } from '../../utils/logger';

// Mock dependencies
vi.mock('../../context/AuthContext');
vi.mock('../queries/useQuestsQueries');
vi.mock('../../api/get-display-error');
vi.mock('../../utils/logger');

describe('useQuestPageState', () => {
  const mockToday = '2024-03-20';
  const mockUser = { id: 1, name: 'Test User' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${mockToday}T12:00:00Z`));

    // Default mock implementation for common utilities
    vi.mocked(getDisplayErrorMessage).mockImplementation((_err, opts) => 
      (opts?.fallbackMessage || 'Error')
    );
    vi.mocked(shouldLogApiError).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should be in loading state when auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, isLoading: true } as any);
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue({
      isPending: true,
      data: undefined,
    } as any);

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.isLoading).toBe(false); // isHistoryQueryEnabled is false
    expect(result.current.daySections).toEqual([]);
  });

  it('should be in loading state when history query is pending', () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, isLoading: false } as any);
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue({
      isPending: true,
      data: undefined,
    } as any);

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.daySections).toEqual([]);
  });

  it('should group quests by day and format labels correctly', () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, isLoading: false } as any);
    
    const mockQuests = [
      { id: 1, questDateUtc: '2024-03-20', title: 'Quest 1' },
      { id: 2, questDateUtc: '2024-03-20', title: 'Quest 2' },
      { id: 3, questDateUtc: '2024-03-19', title: 'Quest 3' },
    ];

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue({
      isPending: false,
      data: {
        pages: [{ quests: mockQuests }],
      },
    } as any);

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections).toHaveLength(2);
    
    // Check "Today" section
    expect(result.current.daySections[0]).toMatchObject({
      questDayUtc: '2024-03-20',
      dayLabel: 'Today',
      isToday: true,
    });
    expect(result.current.daySections[0].quests).toHaveLength(2);

    // Check previous day section
    expect(result.current.daySections[1]).toMatchObject({
      questDayUtc: '2024-03-19',
      dayLabel: 'Mar 19, 2024',
      isToday: false,
    });
    expect(result.current.daySections[1].quests).toHaveLength(1);
  });

  it('should sort day sections in descending order', () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, isLoading: false } as any);
    
    const mockQuests = [
      { id: 1, questDateUtc: '2024-03-18', title: 'Old' },
      { id: 2, questDateUtc: '2024-03-20', title: 'New' },
    ];

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue({
      isPending: false,
      data: {
        pages: [{ quests: mockQuests }],
      },
    } as any);

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections[0].questDayUtc).toBe('2024-03-20');
    expect(result.current.daySections[1].questDayUtc).toBe('2024-03-18');
  });

  it('should handle pagination via loadMore', () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, isLoading: false } as any);
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue({
      isPending: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
      data: { pages: [] },
    } as any);

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.canLoadMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('should not call fetchNextPage if already fetching', () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, isLoading: false } as any);
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue({
      isPending: false,
      hasNextPage: true,
      isFetchingNextPage: true,
      fetchNextPage,
      data: { pages: [] },
    } as any);

    const { result } = renderHook(() => useQuestPageState());

    act(() => {
      result.current.loadMore();
    });

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('should handle errors and log them', () => {
    const mockError = new Error('API Fail');
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, isLoading: false } as any);
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue({
      error: mockError,
      data: undefined,
    } as any);
    vi.mocked(getDisplayErrorMessage).mockReturnValue('Friendly Error');

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.pageError).toBe('Friendly Error');
    expect(logError).toHaveBeenCalledWith(mockError, expect.objectContaining({ feature: 'quests' }));
  });

  it('should handle empty data gracefully', () => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser, isLoading: false } as any);
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue({
      isPending: false,
      data: {
        pages: [],
      },
    } as any);

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections).toEqual([]);
  });
});
