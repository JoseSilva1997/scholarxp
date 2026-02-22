// AuthorizationGuard orchestrates metadata lookup, optional resource loading, and policy evaluation.
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
import { GlobalRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../types/auth-user.type';
import { AUTHORIZATION_KEY } from '../decorators/authorize.decorator';
import type {
  AuthorizationRule,
  ModuleAuthorizationContext,
} from '../authorization/authorization.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { Role } from '@scholarxp/permissions';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  
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
        ? await this.loadModuleContext(req, user)
        : undefined;

    const allowed = this.authorizationService.canActivate({
      user,
      rule,
      moduleContext,
    });

    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  // Resource loading stays in the guard so policy evaluation remains pure and unit-testable.
  private async loadModuleContext(
    req: Request,
    user: AuthUser,
  ): Promise<ModuleAuthorizationContext> {
    const moduleId = this.extractModuleId(req);
    if (!moduleId) {
      throw new BadRequestException('Module id is required for this action');
    }

    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        institutionId: true,
        createdByUserId: true,
        userModules: {
          where: { userId: user.id },
          select: { roleInModule: true },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    let hasInstitutionMatch = false;
    if (
      user.globalRole === GlobalRole.institution_admin &&
      module.institutionId !== null
    ) {
      const membership = await this.prisma.ltiIdentity.findFirst({
        where: {
          userId: user.id,
          institutionId: module.institutionId,
        },
        select: { id: true },
      });
      hasInstitutionMatch = Boolean(membership);
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
      moduleInstitutionId: module.institutionId,
      moduleCreatedByUserId: module.createdByUserId,
      roleInModule,
      hasInstitutionMatch,
    };
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
}
