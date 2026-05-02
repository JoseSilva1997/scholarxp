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
    userModule: { findUnique: jest.fn() },
    moduleUnit: { findUnique: jest.fn() },
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
    (authorizationService.canActivate as jest.Mock).mockReturnValue({
      allowed: false,
      reason: 'capability',
    });

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
        }),
      ),
    ).rejects.toMatchObject({
      message: 'Insufficient permissions',
      constructor: ForbiddenException,
    });
  });

  it('uses module-membership copy when policy denies due to missing enrollment', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.manageContent,
      scope: 'module',
    } as AuthorizationRule);
    (prisma.module.findUnique as jest.Mock).mockResolvedValue({
      id: 77,
      createdByUserId: 99,
      archivedAt: null,
      userModules: [],
    });
    (authorizationService.canActivate as jest.Mock).mockReturnValue({
      allowed: false,
      reason: 'module_membership',
    });

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { moduleId: '77' },
        }),
      ),
    ).rejects.toMatchObject({
      message: "You don't have access to this module.",
    });
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
          } as any,
          params: { moduleId: '77' },
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides archived modules from normal module-scoped routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.navigation.modules,
      scope: 'module',
    } as AuthorizationRule);
    (prisma.module.findUnique as jest.Mock).mockResolvedValue({
      id: 77,
      createdByUserId: 1,
      archivedAt: new Date('2026-04-01T00:00:00.000Z'),
      userModules: [{ roleInModule: 'teacher' }],
    });

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { moduleId: '77' },
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(authorizationService.canActivate).not.toHaveBeenCalled();
  });

  it('allows archive/delete routes to authorize already archived modules', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.delete,
      scope: 'module',
      allowArchived: true,
    } as AuthorizationRule);
    (prisma.module.findUnique as jest.Mock).mockResolvedValue({
      id: 77,
      createdByUserId: 1,
      archivedAt: new Date('2026-04-01T00:00:00.000Z'),
      userModules: [{ roleInModule: 'teacher' }],
    });
    (authorizationService.canActivate as jest.Mock).mockReturnValue({
      allowed: true,
    });

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { moduleId: '77' },
        }),
      ),
    ).resolves.toBe(true);
  });

  it('resolves module context from user-module id when requested', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.settings,
      scope: 'module',
      moduleContextSource: 'user_module',
    } as AuthorizationRule);
    (prisma.userModule.findUnique as jest.Mock).mockResolvedValue({
      moduleId: 55,
    });
    (prisma.module.findUnique as jest.Mock).mockResolvedValue({
      id: 55,
      createdByUserId: 1,
      archivedAt: null,
      userModules: [{ roleInModule: 'teacher' }],
    });
    (authorizationService.canActivate as jest.Mock).mockReturnValue({
      allowed: true,
    });

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { id: '9' },
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.userModule.findUnique).toHaveBeenCalledWith({
      where: { id: 9 },
      select: { moduleId: true },
    });
    expect(prisma.module.findUnique).toHaveBeenCalledWith({
      where: { id: 55 },
      select: {
        id: true,
        createdByUserId: true,
        archivedAt: true,
        userModules: {
          where: { userId: 1 },
          select: { roleInModule: true },
        },
      },
    });
  });

  it('throws bad request when user-module source id is invalid', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.settings,
      scope: 'module',
      moduleContextSource: 'user_module',
    } as AuthorizationRule);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { id: 'abc' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when user-module record is missing', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.settings,
      scope: 'module',
      moduleContextSource: 'user_module',
    } as AuthorizationRule);
    (prisma.userModule.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { id: '9' },
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves module context from module-unit id when requested', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.manageContent,
      scope: 'module',
      moduleContextSource: 'module_unit',
    } as AuthorizationRule);
    (prisma.moduleUnit.findUnique as jest.Mock).mockResolvedValue({
      moduleId: 44,
    });
    (prisma.module.findUnique as jest.Mock).mockResolvedValue({
      id: 44,
      createdByUserId: 1,
      archivedAt: null,
      userModules: [{ roleInModule: 'teacher' }],
    });
    (authorizationService.canActivate as jest.Mock).mockReturnValue({
      allowed: true,
    });

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { id: '12' },
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.moduleUnit.findUnique).toHaveBeenCalledWith({
      where: { id: 12 },
      select: { moduleId: true },
    });
    expect(prisma.module.findUnique).toHaveBeenCalledWith({
      where: { id: 44 },
      select: {
        id: true,
        createdByUserId: true,
        archivedAt: true,
        userModules: {
          where: { userId: 1 },
          select: { roleInModule: true },
        },
      },
    });
  });

  it('throws bad request when module-unit source id is invalid', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.manageContent,
      scope: 'module',
      moduleContextSource: 'module_unit',
    } as AuthorizationRule);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { id: 'abc' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when module-unit record is missing', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.modules.manageContent,
      scope: 'module',
      moduleContextSource: 'module_unit',
    } as AuthorizationRule);
    (prisma.moduleUnit.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.teacher,
          } as any,
          params: { id: '12' },
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes self target id to authorization service for self scope', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.users.selectOwnRole,
      scope: 'self',
      selfUserIdParam: 'id',
    } as AuthorizationRule);
    (authorizationService.canActivate as jest.Mock).mockReturnValue({
      allowed: true,
    });

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.pending,
          } as any,
          params: { id: '1' },
        }),
      ),
    ).resolves.toBe(true);

    expect(authorizationService.canActivate).toHaveBeenCalledWith(
      expect.objectContaining({
        selfTargetUserId: 1,
      }),
    );
  });

  it('throws bad request when self scope target id is invalid', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      capability: features.users.selectOwnRole,
      scope: 'self',
      selfUserIdParam: 'id',
    } as AuthorizationRule);

    await expect(
      guard.canActivate(
        contextFor({
          user: {
            id: 1,
            globalRole: GlobalRole.pending,
          } as any,
          params: { id: 'not-a-number' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
