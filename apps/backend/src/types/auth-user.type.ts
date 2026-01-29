// Describes the authenticated user shape shared across auth guards, controllers, and responses.
export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  profilePictureUrl: string;
  globalRole: import('@prisma/client').GlobalRole;
  isVerified: boolean;
  // Membership hints allow UI and guards to gate institution-scoped actions without extra lookups.
  institutionIds?: number[];
  hasInstitutionMembership?: boolean;
  // LTI identities are slim to avoid leaking broader LMS data.
  ltiIdentities?: { institutionId: number; ltiUserId: string }[];
  hasLtiIdentity?: boolean;
  avatar?: {
    id: number;
    level: number;
    currentExp: number;
  } | null;
};
