import type { FeatureKey } from '@scholarxp/permissions';

/**
 * Auth domain contracts for ScholarXP
 */

export type GlobalRole = 'pending' | 'admin' | 'institution_admin' | 'teacher' | 'student';

// Account progression view derived from canonical totalExp.
export interface AccountProgress {
  id: number;
  totalExp: number;
  level: number;
  currentLevelExp: number;
  nextLevelExpRequired: number;
  xpToNextLevel: number;
  progressPercent: number;
}

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  profilePictureUrl: string;
  globalRole: GlobalRole;
  isVerified: boolean;
  timezone: string;
  institutionIds?: number[];
  hasInstitutionMembership?: boolean;
  ltiIdentities?: { institutionId: number; ltiUserId: string }[];
  hasLtiIdentity?: boolean;
  requiresEmailVerification?: boolean;
  avatar?: AccountProgress | null;
  capabilities?: FeatureKey[];
}

export interface AuthResponse {
  user: AuthUser | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface RegisterResponse extends AuthResponse {
  pendingEmailVerification?: boolean;
}

export interface LogoutResponse {
  ok: boolean;
  csrfToken?: string;
}

export interface VerifyEmailPayload {
  token: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface ResendVerificationResponse {
  sent: boolean;
  reason?: 'already_verified';
}

export interface UpdateUserRolePayload {
  globalRole: Exclude<GlobalRole, 'pending'>;
}

export interface UpdateTimezonePayload {
  timezone: string;
}
