import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query-keys';

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const useQueryClientMock = vi.fn(() => ({
  invalidateQueries: invalidateQueriesMock,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: unknown) => useQueryMock(opts),
  useMutation: (opts: unknown) => useMutationMock(opts),
  useQueryClient: () => useQueryClientMock(),
}));

const getTodayDailyPracticeMock = vi.fn();
const submitDailyPracticeAttemptMock = vi.fn();
const closeDailyPracticeSessionMock = vi.fn();

vi.mock('../../api/daily-practice', () => ({
  getTodayDailyPractice: (...args: unknown[]) =>
    getTodayDailyPracticeMock(...args),
  submitDailyPracticeAttempt: (...args: unknown[]) =>
    submitDailyPracticeAttemptMock(...args),
  closeDailyPracticeSession: (...args: unknown[]) =>
    closeDailyPracticeSessionMock(...args),
}));

import {
  useCloseDailyPracticeSessionMutation,
  useSubmitDailyPracticeAttemptMutation,
  useTodayDailyPracticeQuery,
} from './useDailyPracticeQueries';

describe('useTodayDailyPracticeQuery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useQueryMock.mockReturnValue({ data: 'ok' });
    useMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    getTodayDailyPracticeMock.mockResolvedValue('result');
    submitDailyPracticeAttemptMock.mockResolvedValue({
      awards: {
        baseQuestionExp: 0,
        firstAttemptBonus: 0,
        streakBonus: 0,
        masteryExp: 0,
        accountExp: 0,
      },
      hasCorrectAttempt: false,
      progress: {
        totalQuestions: 7,
        answeredQuestions: 1,
        completedAt: null,
      },
      encounterGrade: 'good',
    });
    closeDailyPracticeSessionMock.mockResolvedValue({
      sessionId: '11111111-1111-4111-8111-111111111110',
      closedAt: '2026-03-20T12:00:00.000Z',
      setCompleted: false,
      progress: {
        totalQuestions: 7,
        answeredQuestions: 1,
        completedAt: null,
      },
    });
    invalidateQueriesMock.mockResolvedValue(undefined);
  });

  it('uses module and session ids in the daily-practice query key', () => {
    const result = useTodayDailyPracticeQuery(
      7,
      '11111111-1111-4111-8111-111111111111',
    );
    const opts = useQueryMock.mock.calls[0][0];

    expect(opts.queryKey).toEqual(
      queryKeys.modules.dailyPractice(
        7,
        '11111111-1111-4111-8111-111111111111',
      ),
    );
    expect(opts.enabled).toBe(true);
    expect(opts.staleTime).toBe(30_000);

    void opts.queryFn();
    expect(getTodayDailyPracticeMock).toHaveBeenCalledWith(7, {
      sessionId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result).toEqual({ data: 'ok' });
  });

  it('disables the query and falls back to a stable key when module id is null', () => {
    useTodayDailyPracticeQuery(null, null);
    const opts = useQueryMock.mock.calls[0][0];

    expect(opts.queryKey).toEqual(queryKeys.modules.dailyPractice(0));
    expect(opts.enabled).toBe(false);

    void opts.queryFn();
    expect(getTodayDailyPracticeMock).toHaveBeenCalledWith(null, {
      sessionId: undefined,
    });
  });
});

describe('useSubmitDailyPracticeAttemptMutation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    invalidateQueriesMock.mockResolvedValue(undefined);
  });

  it('wires mutationFn to submitDailyPracticeAttempt when module id is valid', async () => {
    useSubmitDailyPracticeAttemptMutation(7);
    const opts = useMutationMock.mock.calls[0][0];
    const payload = {
      setId: '11111111-1111-4111-8111-111111111112',
      moduleUnitId: 11,
      questionUnitId: 101,
      questionContentId: 501,
      sessionId: '11111111-1111-4111-8111-111111111113',
      timeTakenMs: 1337,
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 0 },
    };

    await opts.mutationFn(payload);

    expect(submitDailyPracticeAttemptMock).toHaveBeenCalledWith(7, payload);
  });

  it('throws when module id is missing', () => {
    useSubmitDailyPracticeAttemptMutation(null);
    const opts = useMutationMock.mock.calls[0][0];

    expect(() => opts.mutationFn({})).toThrow(
      'Cannot submit a daily-practice attempt',
    );
  });

  it('invalidates daily-practice, quests, rewards, and auth caches after a successful submit', async () => {
    const result = useSubmitDailyPracticeAttemptMutation(7);

    await result.syncAttemptSuccessEffects({
      awards: {
        baseQuestionExp: 0,
        firstAttemptBonus: 0,
        streakBonus: 0,
        masteryExp: 0,
        accountExp: 0,
      },
      hasCorrectAttempt: true,
      progress: {
        totalQuestions: 7,
        answeredQuestions: 3,
        completedAt: null,
      },
      encounterGrade: 'good',
    });

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.modules.dailyPracticeBase(7),
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.quests.all,
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.quests.masterStreakAll,
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.rewards.dailyLessonXpTrackAll,
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.auth.me,
    });
  });
});

describe('useCloseDailyPracticeSessionMutation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
  });

  it('wires mutationFn to closeDailyPracticeSession when module id is valid', async () => {
    useCloseDailyPracticeSessionMutation(7);
    const opts = useMutationMock.mock.calls[0][0];

    await opts.mutationFn('11111111-1111-4111-8111-111111111114');

    expect(closeDailyPracticeSessionMock).toHaveBeenCalledWith(
      7,
      '11111111-1111-4111-8111-111111111114',
    );
  });

  it('throws when module id is missing', () => {
    useCloseDailyPracticeSessionMutation(null);
    const opts = useMutationMock.mock.calls[0][0];

    expect(() => opts.mutationFn('session-id')).toThrow(
      'Cannot close a daily-practice session',
    );
  });
});
