// AuthorizationService evaluates route authorization rules using shared capabilities and resource context.
// Implements a Strategy pattern over scope kinds (global / module / self): each scope has its own
// pure evaluator and the public canActivate dispatches based on the metadata supplied by the
// @Authorize decorator. The service is intentionally side-effect free -- the AuthorizationGuard
// is responsible for fetching the resource context that feeds these checks.
import { Injectable } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { canAccess } from '@scholarxp/permissions';
import type {
  AuthorizationEvaluation,
  AuthorizationOutcome,
  ModuleAuthorizationContext,
} from './authorization.types';

@Injectable()
export class AuthorizationService {
  // Returns a discriminated outcome so the guard can map specific denial reasons to user-facing copy.
  // Time complexity: O(1) -- capability lookup is a constant-time table hit and scope dispatch
  // performs at most a handful of field comparisons. Space complexity: O(1).
  canActivate(input: AuthorizationEvaluation): AuthorizationOutcome {
    const { user, rule } = input;
    const allowedByCapability = canAccess(rule.capability, {
      role: user.globalRole,
    });
    if (!allowedByCapability) {
      return { allowed: false, reason: 'capability' };
    }

    if (!rule.scope || rule.scope === 'global') {
      return { allowed: true };
    }

    if (rule.scope === 'module') {
      const allowed = this.canAccessModuleScope(
        user.id,
        user.globalRole as GlobalRole,
        input.moduleContext,
      );
      return allowed
        ? { allowed: true }
        : { allowed: false, reason: 'module_membership' };
    }

    if (rule.scope === 'self') {
      const allowed = this.canSelfScope(user.id, input.selfTargetUserId);
      return allowed ? { allowed: true } : { allowed: false, reason: 'self' };
    }

    return { allowed: false, reason: 'capability' };
  }

  // Module scope rules enforce ownership/membership boundaries after capability checks pass.
  private canAccessModuleScope(
    userId: number,
    role: GlobalRole,
    moduleContext: ModuleAuthorizationContext | undefined,
  ): boolean {
    if (!moduleContext) {
      return false;
    }

    if (role === GlobalRole.admin) {
      return true;
    }

    if (role === GlobalRole.teacher) {
      return (
        moduleContext.roleInModule === 'teacher' ||
        moduleContext.moduleCreatedByUserId === userId
      );
    }

    if (role === GlobalRole.student) {
      return moduleContext.roleInModule === 'student';
    }

    return false;
  }

  // Self scope rules enforce that users can only access their own resources.
  private canSelfScope(userId: number, selfTargetUserId: number | undefined) {
    if (!selfTargetUserId) {
      return false;
    }
    return userId === selfTargetUserId;
  }
}
