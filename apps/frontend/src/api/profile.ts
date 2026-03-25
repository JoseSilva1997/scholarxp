// Profile API client: fetches aggregated profile data for the current user's role.
import type {
  StudentProfileResponse,
  TutorProfileResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from './client';

export async function getStudentProfile(): Promise<StudentProfileResponse> {
  return apiFetch<StudentProfileResponse>('/profile/student');
}

export async function getTutorProfile(): Promise<TutorProfileResponse> {
  return apiFetch<TutorProfileResponse>('/profile/tutor');
}
