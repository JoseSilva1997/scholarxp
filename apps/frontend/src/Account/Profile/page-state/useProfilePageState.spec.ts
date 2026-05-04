// Verifies profile page state selects the right role query and preserves local UI controls.
import { act, renderHook } from '@testing-library/react';
import type { AuthUser } from '@scholarxp/api-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/context/AuthContext';
import { useProfilePageState } from '@/Account/Profile/page-state/useProfilePageState';
import {
  useStudentProfileQuery,
  useTutorProfileQuery,
} from '@/Account/Profile/queries/useProfileQueries';

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/Account/Profile/queries/useProfileQueries', () => ({
  useStudentProfileQuery: vi.fn(),
  useTutorProfileQuery: vi.fn(),
}));

function buildUser(globalRole: AuthUser['globalRole']): AuthUser {
  return {
    id: 10,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    profilePictureUrl: '',
    globalRole,
    isVerified: true,
    timezone: 'UTC',
    avatar: null,
  };
}

describe('useProfilePageState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStudentProfileQuery).mockReturnValue({ isPending: false, data: undefined } as never);
    vi.mocked(useTutorProfileQuery).mockReturnValue({ isPending: false, data: undefined } as never);
  });

  it('enables the student profile query for student users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: buildUser('student'),
      isLoading: false,
    } as never);
    vi.mocked(useStudentProfileQuery).mockReturnValue({
      isPending: false,
      data: { accountLevel: 12 },
    } as never);

    const { result } = renderHook(() => useProfilePageState());

    expect(result.current.isStudent).toBe(true);
    expect(result.current.studentProfile).toEqual({ accountLevel: 12 });
    expect(useStudentProfileQuery).toHaveBeenCalledWith(true, 10);
    expect(useTutorProfileQuery).toHaveBeenCalledWith(false, 10);
  });

  it('enables the tutor profile query for teacher users and reports loading from that query', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: buildUser('teacher'),
      isLoading: false,
    } as never);
    vi.mocked(useTutorProfileQuery).mockReturnValue({
      isPending: true,
      data: undefined,
    } as never);

    const { result } = renderHook(() => useProfilePageState());

    expect(result.current.isTutor).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(useStudentProfileQuery).toHaveBeenCalledWith(false, 10);
    expect(useTutorProfileQuery).toHaveBeenCalledWith(true, 10);
  });

  it('keeps local edit and sort state mutable', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: buildUser('student'),
      isLoading: false,
    } as never);

    const { result } = renderHook(() => useProfilePageState());

    act(() => {
      result.current.setModuleSortKey('recent');
      result.current.setIsEditingProfile(true);
    });

    expect(result.current.moduleSortKey).toBe('recent');
    expect(result.current.isEditingProfile).toBe(true);
  });

  it('stays loading while auth is loading and disables role queries', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: buildUser('student'),
      isLoading: true,
    } as never);

    const { result } = renderHook(() => useProfilePageState());

    expect(result.current.isLoading).toBe(true);
    expect(useStudentProfileQuery).toHaveBeenCalledWith(false, 10);
  });
});
