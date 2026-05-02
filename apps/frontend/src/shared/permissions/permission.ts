// Frontend wrapper around the shared permission matrix so UI gates stay aligned with backend auth.
import {
  canAccess as evaluateAccess,
  listCapabilities,
  permissionMatrix,
  type FeatureKey,
  type UserContext,
} from '@scholarxp/permissions';
import type { AuthUser } from '@scholarxp/api-contracts';

// Adapts the frontend auth shape into the smaller permission package context.
function toUserContext(user: AuthUser | null | undefined): UserContext | null {
  if (!user) return null;
  return {
    role: user.globalRole,
  };
}

// Prefer server-computed capabilities when present; otherwise evaluate locally using shared logic.
// Adapter pattern: isolates UI callers from the source of permission truth.
export function canUserAccess(feature: FeatureKey, user: AuthUser | null | undefined): boolean {
  const capabilityList = user?.capabilities;
  if (capabilityList && capabilityList.length > 0) {
    return capabilityList.includes(feature);
  }
  return evaluateAccess(feature, toUserContext(user));
}

// Exposes the permission package's role lookup through the frontend's AuthUser role type.
export function listRolePermissions(role: AuthUser['globalRole']): FeatureKey[] {
  return listCapabilities({ role });
}

export { permissionMatrix };
