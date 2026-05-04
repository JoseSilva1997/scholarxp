// Verifies profile query hooks use role-specific cache keys and enablement rules.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/shared/hooks/query-keys';
import {
  useStudentProfileQuery,
  useTutorProfileQuery,
} from '@/Account/Profile/queries/useProfileQueries';

const apiMocks = vi.hoisted(() => ({
  getStudentProfile: vi.fn(),
  getTutorProfile: vi.fn(),
}));

vi.mock('@/Account/Profile/api/profile', () => ({
  getStudentProfile: apiMocks.getStudentProfile,
  getTutorProfile: apiMocks.getTutorProfile,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useProfileQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    apiMocks.getStudentProfile.mockReset();
    apiMocks.getTutorProfile.mockReset();
  });

  it('fetches student profile data under the student profile key', async () => {
    const response = { accountLevel: 4 };
    apiMocks.getStudentProfile.mockResolvedValue(response);

    const { result } = renderHook(() => useStudentProfileQuery(true, 77), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(response);
    expect(queryClient.getQueryData(queryKeys.profile.student(77))).toBe(response);
    expect(apiMocks.getStudentProfile).toHaveBeenCalledTimes(1);
  });

  it('fetches tutor profile data under the tutor profile key', async () => {
    const response = { modulesCreated: 2 };
    apiMocks.getTutorProfile.mockResolvedValue(response);

    const { result } = renderHook(() => useTutorProfileQuery(true, 88), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(response);
    expect(queryClient.getQueryData(queryKeys.profile.tutor(88))).toBe(response);
    expect(apiMocks.getTutorProfile).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while disabled', () => {
    renderHook(() => useStudentProfileQuery(false, 77), {
      wrapper: createWrapper(queryClient),
    });
    renderHook(() => useTutorProfileQuery(false, 88), {
      wrapper: createWrapper(queryClient),
    });

    expect(apiMocks.getStudentProfile).not.toHaveBeenCalled();
    expect(apiMocks.getTutorProfile).not.toHaveBeenCalled();
  });

  it('uses null cache keys while disabled before the user id is known', () => {
    renderHook(() => useStudentProfileQuery(false), {
      wrapper: createWrapper(queryClient),
    });
    renderHook(() => useTutorProfileQuery(false), {
      wrapper: createWrapper(queryClient),
    });

    expect(queryClient.getQueryState(queryKeys.profile.student(null))).toBeTruthy();
    expect(queryClient.getQueryState(queryKeys.profile.tutor(null))).toBeTruthy();
  });
});
