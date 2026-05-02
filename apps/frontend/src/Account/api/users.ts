// Provides user-specific API helpers such as updating global role and timezone.
import { apiFetch } from '@/shared/api/client';
import {
  PROFILE_PICTURE_UPLOAD_FIELD,
  type AuthUser,
  type DeleteAccountPayload,
  type GlobalRole,
  type UpdateNamePayload,
  type UpdateNameResponse,
  type UpdateProfilePictureResponse,
  type UpdateTimezonePayload,
  type UpdateUserRolePayload,
} from '@scholarxp/api-contracts';

// Updates the active account role after onboarding or role switching.
export async function updateUserRole(userId: number, globalRole: Exclude<GlobalRole, 'pending'>) {
  const payload: UpdateUserRolePayload = { globalRole };
  return apiFetch<AuthUser>(`/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Persists the user's display name and returns the refreshed authenticated user contract.
export async function updateName(
  userId: number,
  firstName: string,
  lastName: string,
) {
  const payload: UpdateNamePayload = { firstName, lastName };
  return apiFetch<UpdateNameResponse>(`/users/${userId}/name`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Persists the user's timezone so time-sensitive practice and quest features use the intended locale.
export async function updateTimezone(userId: number, timezone: string) {
  const payload: UpdateTimezonePayload = { timezone };
  return apiFetch<AuthUser>(`/users/${userId}/timezone`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Uploads a replacement profile picture using multipart form data expected by the backend file interceptor.
export async function uploadProfilePicture(userId: number, file: Blob) {
  const formData = new FormData();
  // Filename is irrelevant once the backend stores by UUID, but Multer requires a name on the part.
  formData.append(PROFILE_PICTURE_UPLOAD_FIELD, file, 'avatar.png');
  return apiFetch<UpdateProfilePictureResponse>(`/users/${userId}/profile-picture`, {
    method: 'PUT',
    body: formData,
  });
}

// Requests irreversible deletion of the current account after client-side email confirmation.
export async function deleteOwnAccount(confirmEmail: string) {
  const payload: DeleteAccountPayload = { confirmEmail };
  return apiFetch<void>(`/users/me`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

// Removes a custom profile picture and returns the account with its fallback avatar state.
export async function removeProfilePicture(userId: number) {
  return apiFetch<UpdateProfilePictureResponse>(`/users/${userId}/profile-picture`, {
    method: 'DELETE',
  });
}
