// Tests for ModuleAccessGuard covering admin, institution admin, instructor, and student read paths.
import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';
import { ModuleAccessGuard } from './module-access.guard';
import {
  MODULE_ACCESS_KEY,
  type ModuleAccessOptions,
} from '../decorators/module-access.decorator';
import {
  createPrismaMock,
  type PrismaMock,
} from '../../test/test-helpers';

describe('ModuleAccessGuard', () => {
  let guard: ModuleAccessGuard;
  let prisma: PrismaMock;
  let reflector: Reflector;

  beforeEach(() => {
    prisma = createPrismaMock();
    reflector = new Reflector();
    guard = new ModuleAccessGuard(prisma, reflector);
  });

  const buildContext = (
    req: any,
    metadata?: ModuleAccessOptions,
  ): ExecutionContext => {
    const handler = {};
    if (metadata) {
      Reflect.defineMetadata(MODULE_ACCESS_KEY, metadata, handler);
    }
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => handler,
      getClass: () => handler,
    } as unknown as ExecutionContext;
  };

  it('allows admin without querying module', async () => {
    const req: any = {
      params: { moduleId: '5' },
      user: { id: 1, globalRole: GlobalRole.admin },
    };

    const result = await guard.canActivate(buildContext(req));

    expect(result).toBe(true);
    expect(prisma.module.findUnique).not.toHaveBeenCalled();
  });

  it('throws when no session user is present', async () => {
    const req: any = { params: { moduleId: '5' } };

    await expect(guard.canActivate(buildContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws BadRequest when moduleId is missing', async () => {
    const req: any = { params: {}, user: { id: 1, globalRole: GlobalRole.admin } };

    await expect(guard.canActivate(buildContext(req))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws NotFound when module does not exist', async () => {
    prisma.module.findUnique.mockResolvedValue(null);
    const req: any = {
      params: { moduleId: '9' },
      user: { id: 2, globalRole: GlobalRole.teacher },
    };

    await expect(guard.canActivate(buildContext(req))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('allows institution_admin within same institution', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 3,
      institutionId: 11,
      userModules: [],
    } as any);
    prisma.ltiIdentity.findFirst.mockResolvedValue({ id: 99 } as any);
    const req: any = {
      params: { moduleId: '3' },
      user: { id: 4, globalRole: GlobalRole.institution_admin },
    };

    const result = await guard.canActivate(buildContext(req));

    expect(result).toBe(true);
    expect(prisma.ltiIdentity.findFirst).toHaveBeenCalledWith({
      where: { userId: 4, institutionId: 11 },
      select: { id: true },
    });
  });

  it('forbids institution_admin from other institutions', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 3,
      institutionId: 12,
      userModules: [],
    } as any);
    prisma.ltiIdentity.findFirst.mockResolvedValue(null);
    const req: any = {
      params: { moduleId: '3' },
      user: { id: 4, globalRole: GlobalRole.institution_admin },
    };

    await expect(guard.canActivate(buildContext(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows instructor linked to the module', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 7,
      institutionId: null,
      userModules: [{ roleInModule: 'teacher' }],
    } as any);
    const req: any = {
      params: { moduleId: '7' },
      user: { id: 8, globalRole: GlobalRole.teacher },
    };

    const result = await guard.canActivate(buildContext(req));

    expect(result).toBe(true);
  });

  it('forbids teacher without module membership', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 7,
      institutionId: null,
      userModules: [],
    } as any);
    const req: any = {
      params: { moduleId: '7' },
      user: { id: 8, globalRole: GlobalRole.teacher },
    };

    await expect(guard.canActivate(buildContext(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows student on read path when allowStudentRead is true', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 15,
      institutionId: null,
      userModules: [{ roleInModule: 'student' }],
    } as any);
    const req: any = {
      params: { moduleId: '15' },
      user: { id: 9, globalRole: GlobalRole.student },
    };

    const result = await guard.canActivate(
      buildContext(req, { allowStudentRead: true }),
    );

    expect(result).toBe(true);
  });

  it('forbids student when allowStudentRead is false', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 15,
      institutionId: null,
      userModules: [{ roleInModule: 'student' }],
    } as any);
    const req: any = {
      params: { moduleId: '15' },
      user: { id: 9, globalRole: GlobalRole.student },
    };

    await expect(guard.canActivate(buildContext(req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
