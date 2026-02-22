import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import { features } from '@scholarxp/permissions';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuthorizationGuard } from './authorization.guard';
import type { AuthorizationRule } from '../authorization/authorization.types';

describe('AuthorizationGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const prisma = {
    module: { findUnique: jest.fn() },
    ltiIdentity: { findFirst: jest.fn() },
  } as unknown as PrismaService;

  const authorizationService = {
    canActivate: jest.fn(),
  } as unknown as AuthorizationService;

  const guard = new AuthorizationGuard(reflector, prisma, authorizationService);

  function contextFor(request: Partial<Request>) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns true when route has no authorization metadata', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
    expect(authorizationService.canActivate).not.toHaveBeenCalled();
  });

  it('throws unauthorized when user is missing', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.create,
    } as AuthorizationRule);

    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws forbidden when policy evaluation denies', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.create,
    } as AuthorizationRule);
    (authorizationService.canActivate as jest.Mock).mockReturnValue(false);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
            hasInstitutionMembership: false,
          } as any,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws bad request when module scope is missing module id', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.settings,
      scope: 'module',
    } as AuthorizationRule);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
            hasInstitutionMembership: false,
          } as any,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when module record does not exist', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.settings,
      scope: 'module',
    } as AuthorizationRule);
    (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
            hasInstitutionMembership: false,
          } as any,
          params: { moduleId: '77' },
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
