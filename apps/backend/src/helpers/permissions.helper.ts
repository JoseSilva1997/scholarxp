// Helper to enforce shared capability rules on the backend and raise consistent HTTP errors.
import { ForbiddenException } from '@nestjs/common';
import { canAccess, type FeatureKey, type Role } from '@scholarxp/permissions';
import type { AuthUser } from '../types/auth-user.type';

export function assertHasAccess(
  feature: FeatureKey,
  user: AuthUser,
  message?: string,
): void {
  const allowed = canAccess(feature, {
    role: user.globalRole as Role,
    hasInstitutionMembership: user.hasInstitutionMembership,
  });
  if (!allowed) {
    // Use ForbiddenException so callers get a clear 403 without leaking details.
    throw new ForbiddenException('Access denied: ' + (message ?? feature));
  }
}
