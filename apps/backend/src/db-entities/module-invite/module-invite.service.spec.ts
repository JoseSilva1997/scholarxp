// Targeted tests for ModuleInviteService enforcing capability checks and CRUD behavior.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole, InviteType, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { ModuleInviteService } from './module-invite.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';
import { MODULE_INVITE_DEFAULT_MAX_USES } from '@scholarxp/constants';

describe('ModuleInviteService', () => {
  let prisma: PrismaMock;
  let service: ModuleInviteService;
  const teacher: any = {
    id: 1,
    firstName: 'Test',
    lastName: 'Teacher',
    email: 'teacher@example.com',
    profilePictureUrl: 'https://example.com/avatar.png',
    globalRole: GlobalRole.teacher,
    isVerified: true,
  };
  const student: any = {
    ...teacher,
    id: 2,
    email: 'student@example.com',
    globalRole: GlobalRole.student,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ModuleInviteService(prisma);
  });

  afterEach(() => jest.resetAllMocks());

  const module = {
    id: 1,
    title: 'Test Module',
    createdAt: new Date(),
    createdByUserId: 1,
    description: null,
  };

  it('creates invite with defaults and returns token + url', async () => {
    prisma.module.findUnique.mockResolvedValue(module as any);
    const createResult = {
      id: 10,
      moduleId: module.id,
      createdByUserId: teacher.id,
      type: InviteType.link,
      tokenHash: 'hash',
      maxUses: MODULE_INVITE_DEFAULT_MAX_USES,
      uses: 0,
      expiresAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
      emailLock: null,
    };
    prisma.moduleInvite.create.mockResolvedValue(createResult as any);

    const result = await service.create(module.id, {}, teacher);

    expect(prisma.moduleInvite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moduleId: module.id,
        createdByUserId: teacher.id,
        type: InviteType.link,
        maxUses: MODULE_INVITE_DEFAULT_MAX_USES,
      }),
    });
    expect(result.invite.id).toBe(createResult.id);
    expect(result.token).toBeDefined();
    expect(result.url).toContain(result.token);
  });

  it('rejects create when module is archived', async () => {
    prisma.module.findUnique.mockResolvedValue({
      ...module,
      archivedAt: new Date('2026-04-01T00:00:00.000Z'),
    } as any);

    await expect(service.create(module.id, {}, teacher)).rejects.toThrow(
      `Module ${module.id} not found`,
    );
  });

  it('finds all invites with module scoping and sanitizes token hash', async () => {
    prisma.module.findUnique.mockResolvedValue(module as any);
    prisma.moduleInvite.findMany.mockResolvedValue([
      {
        id: 1,
        moduleId: module.id,
        tokenHash: 'h',
        uses: 0,
        maxUses: null,
        createdAt: new Date(),
        createdByUserId: 1,
        type: InviteType.link,
        expiresAt: null,
        revokedAt: null,
        emailLock: null,
      },
    ] as any);

    const result = await service.findAll(module.id);

    expect(prisma.moduleInvite.findMany).toHaveBeenCalledWith({
      where: { moduleId: module.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(result[0]).not.toHaveProperty('tokenHash');
  });

  it('finds, updates, unrevoke/revokes, and removes invites within their module', async () => {
    const invite = {
      id: 7,
      moduleId: module.id,
      tokenHash: 'private',
      uses: 0,
      maxUses: 5,
      createdAt: new Date(),
      createdByUserId: 1,
      type: InviteType.link,
      expiresAt: null,
      revokedAt: null,
      emailLock: null,
    };
    prisma.module.findUnique.mockResolvedValue(module as any);
    prisma.moduleInvite.findUnique.mockResolvedValue(invite as any);
    prisma.moduleInvite.update.mockResolvedValue({
      ...invite,
      maxUses: 10,
      expiresAt: new Date('2026-05-01T00:00:00.000Z'),
      revokedAt: null,
    } as any);
    prisma.moduleInvite.delete.mockResolvedValue(invite as any);

    const found = await service.findOne(invite.id);
    const updated = await service.update(module.id, invite.id, {
      maxUses: 10,
      expiresAt: '2026-05-01T00:00:00.000Z',
      revoke: false,
    });
    const deleted = await service.remove(module.id, invite.id);

    expect(found.id).toBe(invite.id);
    expect(prisma.moduleInvite.update).toHaveBeenCalledWith({
      where: { id: invite.id },
      data: {
        maxUses: 10,
        expiresAt: new Date('2026-05-01T00:00:00.000Z'),
        revokedAt: null,
      },
    });
    expect(updated).not.toHaveProperty('tokenHash');
    expect(deleted).not.toHaveProperty('tokenHash');

    await service.update(module.id, invite.id, { revoke: true });
    expect(prisma.moduleInvite.update).toHaveBeenLastCalledWith({
      where: { id: invite.id },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects missing modules, missing invites, and cross-module invite updates', async () => {
    prisma.module.findUnique.mockResolvedValueOnce(null);
    await expect(service.findAll(module.id)).rejects.toThrow(NotFoundException);

    prisma.module.findUnique.mockResolvedValue(module as any);
    prisma.moduleInvite.findUnique.mockResolvedValueOnce(null);
    await expect(service.update(module.id, 404, {})).rejects.toThrow(
      NotFoundException,
    );

    prisma.moduleInvite.findUnique.mockResolvedValueOnce({
      id: 8,
      moduleId: 999,
    } as any);
    await expect(service.remove(module.id, 8)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('redeems invite and increments usage', async () => {
    const token = 'abc';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invite = {
      id: 2,
      moduleId: module.id,
      createdByUserId: 1,
      type: InviteType.link,
      tokenHash,
      maxUses: 2,
      uses: 0,
      expiresAt: new Date(Date.now() + 1000 * 60),
      revokedAt: null,
      createdAt: new Date(),
      emailLock: null,
      module,
    };

    prisma.moduleInvite.findFirst.mockResolvedValue(invite as any);
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma as any));
    prisma.moduleInvite.findUnique.mockResolvedValue(invite as any);
    prisma.userModule.create.mockResolvedValue({ id: 99 } as any);
    prisma.moduleInvite.updateMany.mockResolvedValue({ count: 1 } as any);

    const result = await service.redeem({ token }, student);

    expect(prisma.userModule.create).toHaveBeenCalledWith({
      data: {
        moduleId: module.id,
        userId: student.id,
        roleInModule: 'student',
        userModuleLevel: 1,
        currentExp: 0,
        enrolledVia: 'invite',
      },
    });
    expect(prisma.moduleInvite.updateMany).toHaveBeenCalledWith({
      where: {
        id: invite.id,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
        uses: { lt: invite.maxUses },
      },
      data: { uses: { increment: 1 } },
    });
    expect(result).toEqual({
      moduleId: module.id,
      inviteId: invite.id,
      enrollmentId: 99,
    });
  });

  it('throws on expired invite during redeem', async () => {
    const token = 'expired';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    prisma.moduleInvite.findFirst.mockResolvedValue({
      id: 4,
      moduleId: module.id,
      createdByUserId: 1,
      type: InviteType.link,
      tokenHash,
      maxUses: 1,
      uses: 1,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      createdAt: new Date(),
      emailLock: null,
      module,
    } as any);

    await expect(service.redeem({ token }, student)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects missing, revoked, and exhausted invites before enrollment', async () => {
    const token = 'missing';
    prisma.moduleInvite.findFirst.mockResolvedValueOnce(null);
    await expect(service.redeem({ token }, student)).rejects.toThrow(
      NotFoundException,
    );

    prisma.moduleInvite.findFirst.mockResolvedValueOnce({
      id: 5,
      moduleId: module.id,
      revokedAt: new Date(),
      expiresAt: null,
      maxUses: 5,
      uses: 0,
      module,
    } as any);
    await expect(service.redeem({ token: 'revoked' }, student)).rejects.toThrow(
      'Invite has been revoked',
    );

    prisma.moduleInvite.findFirst.mockResolvedValueOnce({
      id: 6,
      moduleId: module.id,
      revokedAt: null,
      expiresAt: null,
      maxUses: 1,
      uses: 1,
      module,
    } as any);
    await expect(
      service.redeem({ token: 'exhausted' }, student),
    ).rejects.toThrow('Invite has reached its usage limit');
  });

  it('does not redeem when user already enrolled', async () => {
    const token = 'dup';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    prisma.moduleInvite.findFirst.mockResolvedValue({
      id: 6,
      moduleId: module.id,
      createdByUserId: 1,
      type: InviteType.link,
      tokenHash,
      maxUses: 5,
      uses: 0,
      expiresAt: new Date(Date.now() + 1000 * 60),
      revokedAt: null,
      createdAt: new Date(),
      emailLock: null,
      module,
    } as any);

    prisma.$transaction.mockImplementation(async (cb) => {
      prisma.moduleInvite.findUnique.mockResolvedValue({
        id: 6,
        moduleId: module.id,
        createdByUserId: 1,
        type: InviteType.link,
        tokenHash,
        maxUses: 5,
        uses: 0,
        expiresAt: new Date(Date.now() + 1000 * 60),
        revokedAt: null,
        createdAt: new Date(),
        emailLock: null,
      } as any);
      prisma.userModule.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Duplicate', {
          code: 'P2002',
          clientVersion: '5.x',
        }),
      );
      return cb(prisma as any);
    });

    await expect(service.redeem({ token }, student)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.moduleInvite.updateMany).not.toHaveBeenCalled();
  });

  it('does not increment usage when the transaction reload cannot find the invite', async () => {
    const token = 'stale';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    prisma.moduleInvite.findFirst.mockResolvedValue({
      id: 15,
      moduleId: module.id,
      tokenHash,
      maxUses: null,
      uses: 0,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
      emailLock: null,
      module,
    } as any);
    prisma.$transaction.mockImplementation(async (cb) => {
      prisma.moduleInvite.findUnique.mockResolvedValue(null);
      return cb(prisma as any);
    });

    await expect(service.redeem({ token }, student)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.userModule.create).not.toHaveBeenCalled();
  });

  it('rejects when invite usage is exhausted by a concurrent redeem', async () => {
    const token = 'race';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invite = {
      id: 16,
      moduleId: module.id,
      tokenHash,
      maxUses: 1,
      uses: 0,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
      emailLock: null,
      module,
    };
    prisma.moduleInvite.findFirst.mockResolvedValue(invite as any);
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma as any));
    prisma.moduleInvite.findUnique.mockResolvedValue(invite as any);
    prisma.userModule.create.mockResolvedValue({ id: 101 } as any);
    prisma.moduleInvite.updateMany.mockResolvedValue({ count: 0 } as any);

    await expect(service.redeem({ token }, student)).rejects.toThrow(
      'Invite has reached its usage limit',
    );
  });

  it('increments unlimited invites without expires/maxUses filters', async () => {
    const token = 'unlimited';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invite = {
      id: 17,
      moduleId: module.id,
      tokenHash,
      maxUses: null,
      uses: 0,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
      emailLock: null,
      module,
    };
    prisma.moduleInvite.findFirst.mockResolvedValue(invite as any);
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma as any));
    prisma.moduleInvite.findUnique.mockResolvedValue(invite as any);
    prisma.userModule.create.mockResolvedValue({ id: 102 } as any);
    prisma.moduleInvite.updateMany.mockResolvedValue({ count: 1 } as any);

    await service.redeem({ token }, student);

    expect(prisma.moduleInvite.updateMany).toHaveBeenCalledWith({
      where: { id: invite.id, revokedAt: null },
      data: { uses: { increment: 1 } },
    });
  });

  it('rejects redeem when module is archived', async () => {
    const token = 'archived-redeem';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    prisma.moduleInvite.findFirst.mockResolvedValue({
      id: 12,
      moduleId: module.id,
      tokenHash,
      module: {
        ...module,
        archivedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    } as any);

    await expect(service.redeem({ token }, student)).rejects.toThrow(
      'Invite not found or expired',
    );
  });
});
