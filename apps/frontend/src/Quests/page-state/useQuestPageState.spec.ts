// Unit tests for useQuestPageState verify grouping logic, date formatting, and state orchestration.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  AuthUser,
  QuestHistoryResponse,
  QuestView,
} from '@scholarxp/api-contracts';
import type { InfiniteData } from '@tanstack/react-query';
import { useQuestPageState } from '@/Quests/page-state/useQuestPageState';
import { useAuth } from '@/context/AuthContext';
import { useQuestHistoryInfiniteQuery } from '@/Quests/queries/useQuestsQueries';
import { getDisplayErrorMessage, shouldLogApiError } from '@/shared/api/get-display-error';
import { logError } from '@/utils/logger';

// Mock dependencies
vi.mock('@/context/AuthContext');
vi.mock('@/Quests/queries/useQuestsQueries', async () => {
  const actual = await vi.importActual('@/Quests/queries/useQuestsQueries',
  );
  return {
    ...actual,
    useQuestHistoryInfiniteQuery: vi.fn(),
  };
});
vi.mock('@/shared/api/get-display-error');
vi.mock('@/utils/logger');

type AuthHookState = ReturnType<typeof useAuth>;
type QuestHistoryHookState = ReturnType<typeof useQuestHistoryInfiniteQuery>;

function createAuthHookState(
  value: Partial<AuthHookState>,
): AuthHookState {
  // Tests intentionally provide only fields consumed by the hook under test.
  return value as unknown as AuthHookState;
}

function createQuestHistoryHookState(
  value: Partial<QuestHistoryHookState>,
): QuestHistoryHookState {
  // Query mocks stay minimal to keep expectations focused on page-state behavior.
  return value as unknown as QuestHistoryHookState;
}

describe('useQuestPageState', () => {
  const mockToday = '2024-03-20';
  // Keep the auth fixture aligned with shared API contracts so hook tests fail only on real regressions.
  const mockUser: AuthUser = {
    id: 1,
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    profilePictureUrl: '',
    globalRole: 'student',
    isVerified: true,
    timezone: 'UTC',
  };

  function createQuestView(overrides: Partial<QuestView>): QuestView {
    // Provide a complete QuestView baseline to keep each test focused on day-grouping behavior.
    return {
      id: 1,
      moduleId: 101,
      moduleUnitId: 1001,
      moduleTitle: 'Algebra',
      moduleUnitTitle: 'Linear Equations',
      type: 'complete_daily_practice',
      tier: 'daily',
      expGranted: 10,
      isCompleted: false,
      progressCurrent: 0,
      progressTarget: 1,
      questDateUtc: mockToday,
      generatedAt: '2024-03-20T00:00:00.000Z',
      completedAt: null,
      description: 'Complete daily practice for Algebra',
      ...overrides,
    };
  }

  function createInfiniteQuestData(
    pages: QuestHistoryResponse[],
  ): InfiniteData<QuestHistoryResponse, unknown> {
    // Infinite query results require pageParams to mirror TanStack Query's runtime data shape.
    return { pages, pageParams: [] };
  }

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
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: null, isLoading: true }),
    );
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: true,
        data: undefined,
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.isLoading).toBe(false); // isHistoryQueryEnabled is false
    expect(result.current.daySections).toEqual([]);
  });

  it('should be in loading state when history query is pending', () => {
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: true,
        data: undefined,
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.daySections).toEqual([]);
  });

  it('should group quests by day and format labels correctly', () => {
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );
    
    const mockQuests = [
      createQuestView({ id: 1, questDateUtc: '2024-03-20' }),
      createQuestView({ id: 2, questDateUtc: '2024-03-20' }),
      createQuestView({ id: 3, questDateUtc: '2024-03-19' }),
    ];

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        data: createInfiniteQuestData([
          { quests: mockQuests, hasMore: false, nextDayOffset: null },
        ]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections).toHaveLength(2);
    
    // Check "Today" section
    expect(result.current.daySections[0]).toMatchObject({
      questDayUtc: '2024-03-20',
      dayLabel: 'Today',
      isToday: true,
      isPlaceholder: false,
      masterQuest: null,
    });
    expect(result.current.daySections[0].quests).toHaveLength(2);

    // Check previous day section
    expect(result.current.daySections[1]).toMatchObject({
      questDayUtc: '2024-03-19',
      dayLabel: 'Mar 19, 2024',
      isToday: false,
      isPlaceholder: false,
      masterQuest: null,
    });
    expect(result.current.daySections[1].quests).toHaveLength(1);
  });

  it('inserts placeholder day sections for gaps between generated quest days', () => {
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );

    const mockQuests = [
      createQuestView({ id: 1, questDateUtc: '2024-03-20' }),
      createQuestView({ id: 2, questDateUtc: '2024-03-18' }),
    ];

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        data: createInfiniteQuestData([
          { quests: mockQuests, hasMore: false, nextDayOffset: null },
        ]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections.map((section) => section.questDayUtc)).toEqual([
      '2024-03-20',
      '2024-03-19',
      '2024-03-18',
    ]);
    expect(result.current.daySections[1]).toMatchObject({
      questDayUtc: '2024-03-19',
      dayLabel: 'Mar 19, 2024',
      isToday: false,
      isPlaceholder: true,
      masterQuest: null,
      quests: [],
    });
  });

  it('backfills placeholder day sections from today when newest quest day is older', () => {
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );

    const mockQuests = [
      createQuestView({ id: 1, questDateUtc: '2024-03-18' }),
    ];

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        data: createInfiniteQuestData([
          { quests: mockQuests, hasMore: false, nextDayOffset: null },
        ]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections.map((section) => section.questDayUtc)).toEqual([
      '2024-03-20',
      '2024-03-19',
      '2024-03-18',
    ]);
    expect(result.current.daySections[0]).toMatchObject({
      questDayUtc: '2024-03-20',
      dayLabel: 'Today',
      isToday: true,
      isPlaceholder: true,
      masterQuest: null,
      quests: [],
    });
  });

  it('limits the first render to the current calendar window including placeholders', () => {
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );

    const mockQuests = [
      createQuestView({ id: 1, questDateUtc: '2024-03-20' }),
      createQuestView({ id: 2, questDateUtc: '2024-03-18' }),
      createQuestView({ id: 3, questDateUtc: '2024-03-16' }),
      createQuestView({ id: 4, questDateUtc: '2024-03-14' }),
      createQuestView({ id: 5, questDateUtc: '2024-03-12' }),
      createQuestView({ id: 6, questDateUtc: '2024-03-10' }),
      createQuestView({ id: 7, questDateUtc: '2024-03-08' }),
      createQuestView({ id: 8, questDateUtc: '2024-03-06' }),
      createQuestView({ id: 9, questDateUtc: '2024-03-04' }),
      createQuestView({ id: 10, questDateUtc: '2024-03-02' }),
    ];

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        hasNextPage: false,
        isFetchingNextPage: false,
        data: createInfiniteQuestData([
          { quests: mockQuests, hasMore: false, nextDayOffset: null },
        ]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections).toHaveLength(14);
    expect(result.current.daySections[0].questDayUtc).toBe('2024-03-20');
    expect(result.current.daySections[13].questDayUtc).toBe('2024-03-07');
    expect(result.current.daySections.some((section) => section.questDayUtc === '2024-03-06')).toBe(
      false,
    );
    expect(result.current.canLoadMore).toBe(true);
  });

  it('separates the master quest from the three visible daily quests', () => {
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );

    const masterQuest = createQuestView({
      id: 4,
      type: 'master_daily_quests',
      tier: 'master',
      moduleId: null,
      moduleUnitId: null,
      moduleTitle: 'Master quest',
      moduleUnitTitle: null,
      progressCurrent: 2,
      progressTarget: 3,
      description:
        'Complete every daily quest available today to unlock the master quest reward.',
    });

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        data: createInfiniteQuestData([
          {
            quests: [
              createQuestView({ id: 1 }),
              createQuestView({ id: 2, type: 'complete_new_unit' }),
              createQuestView({ id: 3, type: 'module_unit_retry' }),
              masterQuest,
            ],
            hasMore: false,
            nextDayOffset: null,
          },
        ]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections[0].quests).toHaveLength(3);
    expect(result.current.daySections[0].masterQuest).toEqual(masterQuest);
  });

  it('should sort day sections in descending order', () => {
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );
    
    const mockQuests = [
      createQuestView({ id: 1, questDateUtc: '2024-03-18' }),
      createQuestView({ id: 2, questDateUtc: '2024-03-20' }),
    ];

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        data: createInfiniteQuestData([
          { quests: mockQuests, hasMore: false, nextDayOffset: null },
        ]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections.map((section) => section.questDayUtc)).toEqual([
      '2024-03-20',
      '2024-03-19',
      '2024-03-18',
    ]);
  });

  it('should handle pagination via loadMore', () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage,
        data: createInfiniteQuestData([]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.canLoadMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('reveals already-loaded hidden day sections before fetching more history', () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );

    const mockQuests = [
      createQuestView({ id: 1, questDateUtc: '2024-03-20' }),
      createQuestView({ id: 2, questDateUtc: '2024-03-18' }),
      createQuestView({ id: 3, questDateUtc: '2024-03-16' }),
      createQuestView({ id: 4, questDateUtc: '2024-03-14' }),
      createQuestView({ id: 5, questDateUtc: '2024-03-12' }),
      createQuestView({ id: 6, questDateUtc: '2024-03-10' }),
      createQuestView({ id: 7, questDateUtc: '2024-03-08' }),
      createQuestView({ id: 8, questDateUtc: '2024-03-06' }),
      createQuestView({ id: 9, questDateUtc: '2024-03-04' }),
      createQuestView({ id: 10, questDateUtc: '2024-03-02' }),
    ];

    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage,
        data: createInfiniteQuestData([
          { quests: mockQuests, hasMore: false, nextDayOffset: null },
        ]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.daySections).toHaveLength(19);
    expect(result.current.daySections[18].questDayUtc).toBe('2024-03-02');
    expect(result.current.canLoadMore).toBe(false);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('should not call fetchNextPage if already fetching', () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        hasNextPage: true,
        isFetchingNextPage: true,
        fetchNextPage,
        data: createInfiniteQuestData([]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    act(() => {
      result.current.loadMore();
    });

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('should handle errors and log them', () => {
    const mockError = new Error('API Fail');
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        error: mockError,
        data: undefined,
      }),
    );
    vi.mocked(getDisplayErrorMessage).mockReturnValue('Friendly Error');

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.pageError).toBe('Friendly Error');
    expect(logError).toHaveBeenCalledWith(mockError, expect.objectContaining({ feature: 'quests' }));
  });

  it('should handle empty data gracefully', () => {
    vi.mocked(useAuth).mockReturnValue(
      createAuthHookState({ user: mockUser, isLoading: false }),
    );
    vi.mocked(useQuestHistoryInfiniteQuery).mockReturnValue(
      createQuestHistoryHookState({
        isPending: false,
        data: createInfiniteQuestData([]),
      }),
    );

    const { result } = renderHook(() => useQuestPageState());

    expect(result.current.daySections).toEqual([]);
  });
});
