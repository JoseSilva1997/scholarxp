// Tests for RolesGuard to confirm role-based access checks behave as intended.
import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const handlerRoles = [GlobalRole.teacher];

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const withRolesMetadata = (
    roles: GlobalRole[] | undefined,
    req: any,
    target: any,
  ) =>
    ({
      getHandler: () => target,
      getClass: () => target,
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as any;

  it('allows when user role matches handler metadata', () => {
    const req: any = {
      user: { globalRole: GlobalRole.teacher },
    };
    const handler = {};
    Reflect.defineMetadata(ROLES_KEY, handlerRoles, handler);

    const result = guard.canActivate(
      withRolesMetadata(handlerRoles, req, handler),
    );

    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user role is not allowed', () => {
    const req: any = {
      user: { globalRole: GlobalRole.student },
    };
    const handler = {};
    Reflect.defineMetadata(ROLES_KEY, handlerRoles, handler);

    expect(() =>
      guard.canActivate(withRolesMetadata(handlerRoles, req, handler)),
    ).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when no user is attached', () => {
    const req: any = {};
    const handler = {};
    Reflect.defineMetadata(ROLES_KEY, handlerRoles, handler);

    expect(() =>
      guard.canActivate(withRolesMetadata(handlerRoles, req, handler)),
    ).toThrow(UnauthorizedException);
  });

  it('falls through when no roles metadata is present', () => {
    const req: any = {};
    const handler = {};

    const result = guard.canActivate(
      withRolesMetadata(undefined, req, handler),
    );

    expect(result).toBe(true);
  });
});
