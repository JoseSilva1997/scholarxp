// Contracts for user-mutating endpoints whose payloads are not auth-scoped (timezone lives in auth).
import type { AuthUser } from '../auth';

// Default sentinel persisted on the user row when no custom or external picture is set;
// the frontend treats anything that does not start with `http` as the bundled default asset.
export const DEFAULT_PROFILE_PICTURE_VALUE = 'default-profile-pic.png';

// Multipart upload field name; shared so the FileInterceptor name and FormData key cannot drift.
export const PROFILE_PICTURE_UPLOAD_FIELD = 'file';

export const PROFILE_PICTURE_MAX_BYTES = 5 * 1024 * 1024;

export const PROFILE_PICTURE_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type ProfilePictureMimeType =
  (typeof PROFILE_PICTURE_ALLOWED_MIME_TYPES)[number];

// Returned from both upload and remove endpoints so callers can write the refreshed user back into auth state.
export type UpdateProfilePictureResponse = AuthUser;
