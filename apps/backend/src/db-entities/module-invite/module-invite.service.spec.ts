// Targeted tests for ModuleInviteService enforcing capability checks and CRUD behavior.
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { GlobalRole, InviteType } from '@prisma/client';
import { createHash } from 'crypto';
import { ModuleInviteService } from './module-invite.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';
import { MODULE_INVITE_DEFAULT_MAX_USES } from '../../constants';

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
    hasInstitutionMembership: false,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ModuleInviteService(prisma);
  });

  afterEach(() => jest.resetAllMocks());

  const module = {
    id: 1,
    title: 'Test Module',
    institutionId: null,
    createdAt: new Date(),
    createdByUserId: 1,
    variantContext: null,
    ltiContextId: null,
    resourceLinkId: null,
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

  it('blocks create when capability missing', async () => {
    const student = { ...teacher, globalRole: GlobalRole.student };
    await expect(service.create(module.id, {} as any, student)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects create when module is institution linked', async () => {
    prisma.module.findUnique.mockResolvedValue({
      ...module,
      institutionId: 9,
    } as any);

    await expect(service.create(module.id, {}, teacher)).rejects.toThrow(
      ForbiddenException,
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

    const result = await service.findAll(module.id, teacher);

    expect(prisma.moduleInvite.findMany).toHaveBeenCalledWith({
      where: { moduleId: module.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(result[0]).not.toHaveProperty('tokenHash');
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
    prisma.moduleInvite.update.mockResolvedValue({
      ...invite,
      uses: invite.uses + 1,
    } as any);
    prisma.userModule.upsert.mockResolvedValue({ id: 99 } as any);

    const result = await service.redeem({ token }, teacher);

    expect(prisma.moduleInvite.update).toHaveBeenCalled();
    expect(prisma.userModule.upsert).toHaveBeenCalledWith({
      where: { moduleId_userId: { moduleId: module.id, userId: teacher.id } },
      update: {},
      create: {
        moduleId: module.id,
        userId: teacher.id,
        roleInModule: 'student',
        userModuleLevel: 1,
        currentExp: 0,
        enrolledVia: 'invite',
      },
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

    await expect(service.redeem({ token }, teacher)).rejects.toThrow(
      BadRequestException,
    );
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

    // Mock the enrollment check to return existing enrollment
    prisma.userModule.findUnique.mockResolvedValue({ id: 123 } as any);
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma as any));

    await expect(service.redeem({ token }, teacher)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.moduleInvite.update).not.toHaveBeenCalled();
  });
});
