// Defines the authenticated user shape returned by the backend session APIs.
import type { FeatureKey } from '@scholarxp/permissions';

export type GlobalRole = 'pending' | 'admin' | 'institution_admin' | 'teacher' | 'student';

export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  profilePictureUrl: string;
  globalRole: GlobalRole;
  isVerified: boolean;
  // Optional institution data: used to gate tutor-facing creation flows when a tutor belongs to an institution.
  institutionIds?: number[];
  hasInstitutionMembership?: boolean;
  ltiIdentities?: { institutionId: number; ltiUserId: string }[];
  hasLtiIdentity?: boolean;
  requiresEmailVerification?: boolean;
  avatar?: {
    id: number;
    level: number;
    currentExp: number;
  } | null;
  // Capabilities computed on the backend ensure UI gates stay aligned with server auth.
  capabilities?: FeatureKey[];
};

export type AuthResponse = {
  user: AuthUser | null;
};
