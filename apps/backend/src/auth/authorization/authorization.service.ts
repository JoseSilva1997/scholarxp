// AuthorizationService evaluates route authorization rules using shared capabilities and resource context.
import { Injectable } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { canAccess } from '@scholarxp/permissions';
import type {
  AuthorizationEvaluation,
  ModuleAuthorizationContext,
} from './authorization.types';

@Injectable()
export class AuthorizationService {
  // Returns true/false so the guard remains the single place that translates policy failures to HTTP errors.
  canActivate(input: AuthorizationEvaluation): boolean {
    const { user, rule } = input;
    const allowedByCapability = canAccess(rule.capability, {
      role: user.globalRole,
    });
    if (!allowedByCapability) {
      return false;
    }

    if (!rule.scope || rule.scope === 'global') {
      return true;
    }

    if (rule.scope === 'module') {
      return this.canAccessModuleScope(
        user.id,
        user.globalRole as GlobalRole,
        input.moduleContext,
      );
    }

    if (rule.scope === 'self') {
      return this.canSelfScope(user.id, input.selfTargetUserId);
    }

    return false;
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
