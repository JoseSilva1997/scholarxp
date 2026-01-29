// RolesGuard enforces handler-level role lists, using req.user populated by the session guard.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../../types/auth-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Allow endpoints without explicit role metadata to proceed unchanged.
    const requiredRoles =
      this.reflector.getAllAndOverride<GlobalRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser;

    if (!user) {
      // Absence of user means auth guard was skipped or session missing.
      throw new UnauthorizedException('Authentication required');
    }

    if (!requiredRoles.includes(user.globalRole)) {
      // Keep message generic to avoid leaking policy details.
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
