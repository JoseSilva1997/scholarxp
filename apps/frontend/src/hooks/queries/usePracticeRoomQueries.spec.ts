import { vi, describe, it, expect, beforeEach } from 'vitest';
import { queryKeys } from '../query-keys';

// Mock react-query's useQuery so we can inspect the options passed in.
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

// Mock the API call so queryFn can be invoked and asserts made.
const getPracticeRoomMock = vi.fn();
const submitPracticeRoomAttemptMock = vi.fn();
vi.mock('../../api/modules', () => ({
  getPracticeRoom: (...args: unknown[]) => getPracticeRoomMock(...args),
  submitPracticeRoomAttempt: (...args: unknown[]) =>
    submitPracticeRoomAttemptMock(...args),
}));

import {
  useModuleUnitPracticeRoomQuery,
  useSubmitModuleUnitPracticeAttemptMutation,
} from './usePracticeRoomQueries';

describe('useModuleUnitPracticeRoomQuery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // default return value for useQuery
    useQueryMock.mockReturnValue({ data: 'ok' });
    useMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    getPracticeRoomMock.mockResolvedValue('result');
    submitPracticeRoomAttemptMock.mockResolvedValue({
      moduleExpAwarded: 0,
      studentExpAwarded: 0,
      hasCorrectAttempt: false,
    });
    invalidateQueriesMock.mockResolvedValue(undefined);
  });

  it('uses numeric ids when both module and unit provided', () => {
    const res = useModuleUnitPracticeRoomQuery(
      5,
      2,
      '11111111-1111-4111-8111-111111111009',
    );
    expect(useQueryMock).toHaveBeenCalled();
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.queryKey).toEqual(
      queryKeys.modules.moduleUnitPracticeRoom(
        5,
        2,
        '11111111-1111-4111-8111-111111111009',
      ),
    );
    expect(opts.enabled).toBe(true);
    expect(opts.staleTime).toBe(30_000);

    // calling queryFn should invoke getPracticeRoom with provided ids
    void opts.queryFn();
    expect(getPracticeRoomMock).toHaveBeenCalledWith(5, 2, {
      sessionId: '11111111-1111-4111-8111-111111111009',
    });
    expect(res).toEqual({ data: 'ok' });
  });

  it('disables query and uses fallback key when module id is null', () => {
    useModuleUnitPracticeRoomQuery(
      null,
      2,
      '11111111-1111-4111-8111-111111111009',
    );
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.queryKey).toEqual(queryKeys.modules.moduleUnitPracticeRoom(0, 0));
    expect(opts.enabled).toBe(false);
    // calling queryFn still calls underlying API with null
    void opts.queryFn();
    expect(getPracticeRoomMock).toHaveBeenCalledWith(null, 2, {
      sessionId: '11111111-1111-4111-8111-111111111009',
    });
  });

  it('disables query when unit id is null', () => {
    useModuleUnitPracticeRoomQuery(
      3,
      null,
      '11111111-1111-4111-8111-111111111009',
    );
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.queryKey).toEqual(queryKeys.modules.moduleUnitPracticeRoom(0, 0));
    expect(opts.enabled).toBe(false);
    void opts.queryFn();
    expect(getPracticeRoomMock).toHaveBeenCalledWith(3, null, {
      sessionId: '11111111-1111-4111-8111-111111111009',
    });
  });

  it('disables query when both ids are null', () => {
    useModuleUnitPracticeRoomQuery(null, null, null);
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.queryKey).toEqual(queryKeys.modules.moduleUnitPracticeRoom(0, 0));
    expect(opts.enabled).toBe(false);
    void opts.queryFn();
    expect(getPracticeRoomMock).toHaveBeenCalledWith(null, null, { sessionId: undefined });
  });
});

describe('useSubmitModuleUnitPracticeAttemptMutation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useQueryMock.mockReturnValue({ data: 'ok' });
    useMutationMock.mockReturnValue({ mutateAsync: vi.fn() });
    getPracticeRoomMock.mockResolvedValue('result');
    submitPracticeRoomAttemptMock.mockResolvedValue({
      moduleExpAwarded: 0,
      studentExpAwarded: 0,
      hasCorrectAttempt: false,
    });
    invalidateQueriesMock.mockResolvedValue(undefined);
  });

  it('wires mutationFn to submitPracticeRoomAttempt when ids are valid', async () => {
    useSubmitModuleUnitPracticeAttemptMutation(5, 2);

    const opts = useMutationMock.mock.calls[0][0];
    const payload = {
      moduleUnitId: 2,
      questionUnitId: 20,
      questionContentId: 50,
      sessionId: '11111111-1111-4111-8111-111111111009',
      practiceMode: 'PRACTICE_ROOM',
      timeTakenMs: 1234,
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 0 },
    };

    await opts.mutationFn(payload);

    expect(submitPracticeRoomAttemptMock).toHaveBeenCalledWith(5, 2, payload);
  });

  it('throws when ids are not valid', async () => {
    useSubmitModuleUnitPracticeAttemptMutation(null, 2);

    const opts = useMutationMock.mock.calls[0][0];
    expect(() =>
      opts.mutationFn({
        moduleUnitId: 2,
        questionUnitId: 20,
        questionContentId: 50,
        sessionId: '11111111-1111-4111-8111-111111111009',
        practiceMode: 'PRACTICE_ROOM',
        timeTakenMs: 1234,
        hintUnlocked: false,
        studentAnswer: { selectedOptionIndex: 0 },
      }),
    ).toThrow('Cannot submit a practice-room attempt');
  });

  it('invalidates the active practice room query on success', async () => {
    useSubmitModuleUnitPracticeAttemptMutation(5, 2);

    const opts = useMutationMock.mock.calls[0][0];
    const mockResponse = {
      moduleExpAwarded: 10,
      studentExpAwarded: 5,
      hasCorrectAttempt: true,
    };
    await opts.onSuccess(mockResponse);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.modules.moduleUnitPracticeRoomBase(5, 2),
    });
  });
});
