// ModuleAccessGuard enforces module-scoped permissions (admin, institution_admin, instructor; optional student read).
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
import {
  MODULE_ACCESS_KEY,
  ModuleAccessOptions,
} from '../decorators/module-access.decorator';
import type { AuthUser } from '../auth.service';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser;
    if (!user) {
      // This guard assumes SessionAuthGuard already ran; bail if missing.
      throw new UnauthorizedException('Authentication required');
    }

    const options =
      this.reflector.getAllAndOverride<ModuleAccessOptions>(MODULE_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? {};

    const moduleId = this.extractModuleId(req, options.paramKey);
    if (!moduleId) {
      throw new BadRequestException('Module id is required for this action');
    }

    // Admins are always allowed.
    if (user.globalRole === GlobalRole.admin) {
      return true;
    }

    // Fetch module with minimal fields plus membership for this user to avoid extra queries.
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

    // Institution admin must belong to the same institution. If institutionId is null, fall back to instructor check.
    if (user.globalRole === GlobalRole.institution_admin) {
      if (module.institutionId == null) {
        throw new ForbiddenException('Module not linked to an institution');
      }
      const isSameInstitution = await this.prisma.ltiIdentity.findFirst({
        where: { userId: user.id, institutionId: module.institutionId },
        select: { id: true },
      });
      if (isSameInstitution) {
        return true;
      }
    }

    // Instructor access: must have a userModule row with roleInModule 'teacher'.
    const membership = module.userModules[0];
    if (
      user.globalRole === GlobalRole.teacher &&
      (membership?.roleInModule === 'teacher' ||
        module.createdByUserId === user.id)
    ) {
      return true;
    }

    // Student read paths: only if explicitly allowed and membership is student.
    if (
      options.allowStudentRead &&
      membership?.roleInModule === 'student' &&
      user.globalRole === GlobalRole.student
    ) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions for module access');
  }

  private extractModuleId(req: Request, paramKey = 'moduleId'): number | null {
    const value =
      req.params?.[paramKey] ??
      req.params?.id ??
      (req.body as Record<string, any>)?.[paramKey] ??
      (req.query as Record<string, any>)?.[paramKey];

    const asNumber = Number(value);
    if (!Number.isFinite(asNumber) || asNumber <= 0) {
      return null;
    }
    return asNumber;
  }
}
