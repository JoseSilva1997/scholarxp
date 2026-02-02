// Helper to enforce shared capability rules on the backend and raise consistent HTTP errors.
import { ForbiddenException, Logger } from '@nestjs/common';
import { canAccess, type FeatureKey, type Role } from '@scholarxp/permissions';
import type { AuthUser } from '../types/auth-user.type';

// Allow callers to override the message/exception so we can emit more specific errors without duplicating logic.
type AccessOptions = {
  message?: string;
  reason?: string;
  exception?: typeof ForbiddenException;
};

export function assertHasAccess(
  feature: FeatureKey,
  user: AuthUser,
  messageOrOptions?: string | AccessOptions,
): void {
  // Backwards compatible: accept either a string (old signature) or an options bag.
  const options: AccessOptions =
    typeof messageOrOptions === 'string'
      ? { message: messageOrOptions }
      : messageOrOptions ?? {};

  const Exception = options.exception ?? ForbiddenException;
  const allowed = canAccess(feature, {
    role: user.globalRole as Role,
    hasInstitutionMembership: user.hasInstitutionMembership,
  });
  if (!allowed) {
    // Keep the user-facing payload sanitized but capture structured reason for observability.
    if (options?.reason) {
      Logger.warn(
        { feature, userId: user.id, reason: options.reason },
        'PermissionDenied',
      );
    }
    throw new Exception('Access denied: ' + (options.message ?? feature));
  }
}
