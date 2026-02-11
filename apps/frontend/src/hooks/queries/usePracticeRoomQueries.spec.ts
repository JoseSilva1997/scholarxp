import { vi, describe, it, expect, beforeEach } from 'vitest';
import { queryKeys } from '../query-keys';

// Mock react-query's useQuery so we can inspect the options passed in.
const useQueryMock = vi.fn();
vi.mock('@tanstack/react-query', () => ({ useQuery: (opts: any) => useQueryMock(opts) }));

// Mock the API call so queryFn can be invoked and asserts made.
const getPracticeRoomMock = vi.fn();
vi.mock('../../api/modules', () => ({ getPracticeRoom: (...args: any[]) => getPracticeRoomMock(...args) }));

import { usePracticeRoomQuery } from './usePracticeRoomQueries';

describe('usePracticeRoomQuery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // default return value for useQuery
    useQueryMock.mockReturnValue({ data: 'ok' });
    getPracticeRoomMock.mockResolvedValue('result');
  });

  it('uses numeric ids when both module and unit provided', () => {
    const res = usePracticeRoomQuery(5, 2);
    expect(useQueryMock).toHaveBeenCalled();
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.queryKey).toEqual(queryKeys.modules.practiceRoom(5, 2));
    expect(opts.enabled).toBe(true);
    expect(opts.staleTime).toBe(30_000);

    // calling queryFn should invoke getPracticeRoom with provided ids
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    opts.queryFn();
    expect(getPracticeRoomMock).toHaveBeenCalledWith(5, 2);
    expect(res).toEqual({ data: 'ok' });
  });

  it('disables query and uses fallback key when module id is null', () => {
    usePracticeRoomQuery(null, 2);
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.queryKey).toEqual(queryKeys.modules.practiceRoom(0, 0));
    expect(opts.enabled).toBe(false);
    // calling queryFn still calls underlying API with null
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    opts.queryFn();
    expect(getPracticeRoomMock).toHaveBeenCalledWith(null, 2);
  });

  it('disables query when unit id is null', () => {
    usePracticeRoomQuery(3, null);
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.queryKey).toEqual(queryKeys.modules.practiceRoom(0, 0));
    expect(opts.enabled).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    opts.queryFn();
    expect(getPracticeRoomMock).toHaveBeenCalledWith(3, null);
  });

  it('disables query when both ids are null', () => {
    usePracticeRoomQuery(null, null);
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.queryKey).toEqual(queryKeys.modules.practiceRoom(0, 0));
    expect(opts.enabled).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    opts.queryFn();
    expect(getPracticeRoomMock).toHaveBeenCalledWith(null, null);
  });
});
