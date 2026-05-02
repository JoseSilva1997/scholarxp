// Profile query hooks centralize server-state wiring for the profile page.
import { useQuery } from '@tanstack/react-query';
import type { StudentProfileResponse, TutorProfileResponse } from '@scholarxp/api-contracts';
import { getStudentProfile, getTutorProfile } from '@/Account/Profile/api/profile';
import { queryKeys } from '@/shared/hooks/query-keys';

// React Query hook for student profile data; the caller controls enablement after role resolution.
export function useStudentProfileQuery(enabled: boolean, userId?: number) {
  return useQuery<StudentProfileResponse>({
    queryKey: queryKeys.profile.student(userId ?? null),
    queryFn: getStudentProfile,
    enabled,
    staleTime: 30_000,
  });
}

// React Query hook for tutor profile data; mirrors the student query to keep role-specific fetching symmetric.
export function useTutorProfileQuery(enabled: boolean, userId?: number) {
  return useQuery<TutorProfileResponse>({
    queryKey: queryKeys.profile.tutor(userId ?? null),
    queryFn: getTutorProfile,
    enabled,
    staleTime: 30_000,
  });
}
