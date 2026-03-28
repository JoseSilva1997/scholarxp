// Profile query hooks centralize server-state wiring for the profile page.
import { useQuery } from '@tanstack/react-query';
import type { StudentProfileResponse, TutorProfileResponse } from '@scholarxp/api-contracts';
import { getStudentProfile, getTutorProfile } from '@/api/profile';
import { queryKeys } from '../query-keys';

export function useStudentProfileQuery(enabled: boolean, userId?: number) {
  return useQuery<StudentProfileResponse>({
    queryKey: queryKeys.profile.student(userId ?? null),
    queryFn: getStudentProfile,
    enabled,
    staleTime: 30_000,
  });
}

export function useTutorProfileQuery(enabled: boolean, userId?: number) {
  return useQuery<TutorProfileResponse>({
    queryKey: queryKeys.profile.tutor(userId ?? null),
    queryFn: getTutorProfile,
    enabled,
    staleTime: 30_000,
  });
}
