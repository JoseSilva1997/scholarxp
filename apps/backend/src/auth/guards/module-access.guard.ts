// ModuleAccessGuard enforces module-scoped permissions (admin/institution admin/teacher/student read).
// It relies on Passport session to populate req.user and keeps DB lookups minimal.
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
  type ModuleAccessOptions,
} from '../decorators/module-access.decorator';
import type { AuthUser } from '../../types/auth-user.type';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser | undefined;
    if (!user) {
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

    if (user.globalRole === GlobalRole.admin) {
      return true;
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

    if (user.globalRole === GlobalRole.institution_admin) {
      if (module.institutionId == null) {
        throw new ForbiddenException('Module not linked to an institution');
      }
      const sameInstitution = await this.prisma.ltiIdentity.findFirst({
        where: { userId: user.id, institutionId: module.institutionId },
        select: { id: true },
      });
      if (sameInstitution) {
        return true;
      }
    }

    const membership = module.userModules[0];
    if (
      user.globalRole === GlobalRole.teacher &&
      (membership?.roleInModule === 'teacher' ||
        module.createdByUserId === user.id)
    ) {
      return true;
    }

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
