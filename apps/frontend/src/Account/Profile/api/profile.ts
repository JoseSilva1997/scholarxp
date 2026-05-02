// Profile API client: fetches aggregated profile data for the current user's role.
import type {
  StudentProfileResponse,
  TutorProfileResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

// Retrieves the aggregated student profile model used by the Account profile route.
export async function getStudentProfile(): Promise<StudentProfileResponse> {
  return apiFetch<StudentProfileResponse>('/profile/student');
}

// Retrieves the aggregated tutor profile model used by the Account profile route.
export async function getTutorProfile(): Promise<TutorProfileResponse> {
  return apiFetch<TutorProfileResponse>('/profile/tutor');
}
