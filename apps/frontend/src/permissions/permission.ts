// Frontend wrapper around the shared permission matrix so UI gates stay aligned with backend auth.
import {
  canAccess as evaluateAccess,
  listCapabilities,
  permissionMatrix,
  type FeatureKey,
  type UserContext,
} from '@scholarxp/permissions';
import type { AuthUser } from '../types/auth';

function toUserContext(user: AuthUser | null | undefined): UserContext | null {
  if (!user) return null;
  return {
    role: user.globalRole,
    hasInstitutionMembership:
      user.hasInstitutionMembership ?? Boolean(user.institutionIds?.length),
  };
}

// Prefer server-computed capabilities when present; otherwise evaluate locally using shared logic.
export function canUserAccess(feature: FeatureKey, user: AuthUser | null | undefined): boolean {
  const capabilityList = user?.capabilities;
  if (capabilityList && capabilityList.length > 0) {
    return capabilityList.includes(feature);
  }
  return evaluateAccess(feature, toUserContext(user));
}

export function listRolePermissions(role: AuthUser['globalRole'], hasInstitution = false): FeatureKey[] {
  return listCapabilities({
    role,
    hasInstitutionMembership: hasInstitution,
  });
}

export { permissionMatrix};
