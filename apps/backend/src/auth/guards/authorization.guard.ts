// AuthorizationGuard orchestrates metadata lookup, optional resource loading, and policy evaluation.
// It is the bridge between the @Authorize decorator (declarative rule) and AuthorizationService
// (pure policy). Resource I/O is deliberately concentrated here so the policy layer stays
// unit-testable without database fixtures.
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '@scholarxp/api-contracts';
import { AUTHORIZATION_KEY } from '../decorators/authorize.decorator';
import type {
  AuthorizationRule,
  ModuleAuthorizationContext,
} from '../authorization/authorization.types';
import { AuthorizationService } from '../authorization/authorization.service';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
  ) {}
  // Read the @Authorize metadata, optionally resolve module or self context from the request,
  // and delegate the allow/deny decision to AuthorizationService. Returning true here is a "no
  // rule attached" pass-through so unannotated routes are never blocked by this guard.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule =
      this.reflector.getAllAndOverride<AuthorizationRule>(AUTHORIZATION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? null;

    if (!rule) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser | undefined;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const moduleContext =
      rule.scope === 'module'
        ? await this.loadModuleContext(req, user, rule)
        : undefined;
    const selfTargetUserId =
      rule.scope === 'self'
        ? this.extractSelfTargetUserId(req, rule.selfUserIdParam ?? 'id')
        : undefined;

    const outcome = this.authorizationService.canActivate({
      user,
      rule,
      moduleContext,
      selfTargetUserId,
    });

    if (!outcome.allowed) {
      throw new ForbiddenException(this.denialMessage(outcome.reason));
    }

    return true;
  }

  // Maps denial reasons to user-facing copy. Capability fallback preserves the legacy string
  // because some clients (e.g. AcceptInvite) still match on it to render context-specific copy.
  private denialMessage(
    reason: 'capability' | 'module_membership' | 'self',
  ): string {
    if (reason === 'module_membership') {
      return "You don't have access to this module.";
    }
    return 'Insufficient permissions';
  }

  // Resource loading stays in the guard so policy evaluation remains pure and unit-testable.
  // Complexity: O(1) database queries (one indexed lookup for the module plus a filtered
  // userModules join restricted to the current user). Space: O(1).
  private async loadModuleContext(
    req: Request,
    user: AuthUser,
    rule: AuthorizationRule,
  ): Promise<ModuleAuthorizationContext> {
    const source = rule.moduleContextSource ?? 'module';
    const moduleId =
      source === 'user_module'
        ? await this.resolveModuleIdFromUserModule(req)
        : source === 'module_unit'
          ? await this.resolveModuleIdFromModuleUnit(req)
          : this.extractModuleId(req);
    if (!moduleId) {
      throw new BadRequestException('Module not specified');
    }

    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        createdByUserId: true,
        archivedAt: true,
        userModules: {
          where: { userId: user.id },
          select: { roleInModule: true },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }
    if (module.archivedAt && !rule.allowArchived) {
      throw new NotFoundException('Module not found');
    }

    const membership = module.userModules[0];

    // membership.roleInModule comes from the DB as a plain string. Narrow it
    // to the specific union expected by ModuleAuthorizationContext to keep
    // the authorization service typesafe and avoid leaking arbitrary strings.
    const rawRole = membership?.roleInModule ?? null;
    const roleInModule =
      rawRole === 'student' || rawRole === 'teacher' ? rawRole : null;

    return {
      moduleId: module.id,
      moduleCreatedByUserId: module.createdByUserId,
      moduleArchivedAt: module.archivedAt,
      roleInModule,
    };
  }

  // Routes keyed by user-module id still authorize against parent module ownership/membership.
  private async resolveModuleIdFromUserModule(
    req: Request,
  ): Promise<number | null> {
    const rawId = req.params?.id;
    const userModuleId = Number(rawId);
    if (!Number.isFinite(userModuleId) || userModuleId <= 0) {
      return null;
    }

    const userModule = await this.prisma.userModule.findUnique({
      where: { id: userModuleId },
      select: { moduleId: true },
    });
    if (!userModule) {
      throw new NotFoundException('UserModule not found');
    }
    return userModule.moduleId;
  }

  // Module-unit routes still authorize at module scope, so resolve parent module id first.
  private async resolveModuleIdFromModuleUnit(
    req: Request,
  ): Promise<number | null> {
    const rawId = req.params?.id;
    const moduleUnitId = Number(rawId);
    if (!Number.isFinite(moduleUnitId) || moduleUnitId <= 0) {
      return null;
    }

    const moduleUnit = await this.prisma.moduleUnit.findUnique({
      where: { id: moduleUnitId },
      select: { moduleId: true },
    });
    if (!moduleUnit) {
      throw new NotFoundException('ModuleUnit not found');
    }
    return moduleUnit.moduleId;
  }

  // Supported lookups mirror existing module guards so migration is non-breaking for current route shapes.
  private extractModuleId(req: Request): number | null {
    const value =
      req.params?.moduleId ??
      req.params?.id ??
      (req.body as Record<string, unknown>)?.moduleId ??
      (req.query as Record<string, unknown>)?.moduleId;

    const asNumber = Number(value);
    if (!Number.isFinite(asNumber) || asNumber <= 0) {
      return null;
    }
    return asNumber;
  }

  // Self scope resolves a target user id from route/body/query so policy checks can compare against req.user.id.
  private extractSelfTargetUserId(
    req: Request,
    targetUserIdParam: 'id' | 'userId',
  ): number {
    const value =
      req.params?.[targetUserIdParam] ??
      (req.body as Record<string, unknown>)?.[targetUserIdParam] ??
      (req.query as Record<string, unknown>)?.[targetUserIdParam];

    const asNumber = Number(value);
    if (!Number.isFinite(asNumber) || asNumber <= 0) {
      throw new BadRequestException('User not specified');
    }
    return asNumber;
  }
}
