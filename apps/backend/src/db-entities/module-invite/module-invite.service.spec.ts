// Targeted tests for ModuleInviteService enforcing capability checks and CRUD behavior.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { ModuleInviteService } from './module-invite.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';

describe('ModuleInviteService', () => {
  let prisma: PrismaMock;
  let service: ModuleInviteService;
  const teacher = {
    id: 1,
    globalRole: GlobalRole.teacher,
    hasInstitutionMembership: false,
  } as any;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ModuleInviteService(prisma);
  });

  afterEach(() => jest.resetAllMocks());

  it('creates invite when user has access', async () => {
    const dto = { moduleId: 1, createdByUserId: 1 } as any;
    prisma.moduleInvite.create.mockResolvedValue({ id: 10 } as any);

    const result = await service.create(dto, teacher);

    expect(prisma.moduleInvite.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual({ id: 10 });
  });

  it('blocks create when capability missing', async () => {
    const student = { ...teacher, globalRole: GlobalRole.student };
    await expect(
      service.create({ moduleId: 1 } as any, student),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('finds all invites with access check', async () => {
    prisma.moduleInvite.findMany.mockResolvedValue([{ id: 1 }] as any);

    const result = await service.findAll(teacher);

    expect(prisma.moduleInvite.findMany).toHaveBeenCalledWith();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('update enforces access and existence', async () => {
    prisma.moduleInvite.findUnique.mockResolvedValue({ id: 2 } as any);
    prisma.moduleInvite.update.mockResolvedValue({ id: 2, uses: 1 } as any);

    const result = await service.update(2, { uses: 1 } as any, teacher);

    expect(prisma.moduleInvite.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { uses: 1 },
    });
    expect(result).toEqual({ id: 2, uses: 1 });
  });

  it('remove enforces access and existence', async () => {
    prisma.moduleInvite.findUnique.mockResolvedValue({ id: 3 } as any);
    prisma.moduleInvite.delete.mockResolvedValue({ id: 3 } as any);

    const result = await service.remove(3, teacher);

    expect(prisma.moduleInvite.delete).toHaveBeenCalledWith({
      where: { id: 3 },
    });
    expect(result).toEqual({ id: 3 });
  });

  it('throws when invite missing', async () => {
    prisma.moduleInvite.findUnique.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
