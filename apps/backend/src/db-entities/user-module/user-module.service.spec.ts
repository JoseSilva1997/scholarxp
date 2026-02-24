// Tests for UserModuleService ensuring module-scoped listing.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserModuleService } from './user-module.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';
import { GlobalRole } from '@prisma/client';

describe('UserModuleService', () => {
  let prisma: PrismaMock;
  let service: UserModuleService;
  const _teacher = {
    id: 1,
    globalRole: GlobalRole.teacher,
    hasInstitutionMembership: false,
  } as any;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UserModuleService(prisma);
  });

  afterEach(() => jest.resetAllMocks());

  it('findAll filters by moduleId when provided', async () => {
    prisma.userModule.findMany.mockResolvedValue([]);

    await service.findAll(5);

    expect(prisma.userModule.findMany).toHaveBeenCalledWith({
      where: { moduleId: 5 },
    });
  });

  it('findAll returns all when moduleId omitted', async () => {
    prisma.userModule.findMany.mockResolvedValue([]);

    await service.findAll(undefined);

    expect(prisma.userModule.findMany).toHaveBeenCalledWith();
  });

  it('findOne throws when missing', async () => {
    prisma.userModule.findUnique.mockResolvedValue(null);

    await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('addStudentModuleExp increments module XP for enrolled student', async () => {
    const now = new Date('2026-02-13T12:00:00.000Z');
    prisma.userModule.findUnique.mockResolvedValue({
      id: 11,
      currentExp: 0,
      userModuleLevel: 1,
    } as any);
    prisma.userModule.update.mockResolvedValue({
      id: 11,
      moduleId: 5,
      userId: 2,
      roleInModule: 'student',
      userModuleLevel: 1,
      currentExp: 50,
      enrolledVia: 'invite',
      createdAt: now,
    } as any);

    const result = await service.addStudentModuleExp(5, 2, 50);

    expect(prisma.userModule.findUnique).toHaveBeenCalledWith({
      where: {
        moduleId_userId: {
          moduleId: 5,
          userId: 2,
        },
      },
      // Service reads currentExp/level to compute progression side effects alongside enrollment lookup.
      select: { id: true, currentExp: true, userModuleLevel: true },
    });
    expect(prisma.userModule.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        currentExp: {
          set: 50,
        },
        userModuleLevel: {
          set: 1,
        },
      },
    });
    expect(result).toEqual({
      id: 11,
      moduleId: 5,
      userId: 2,
      roleInModule: 'student',
      userModuleLevel: 1,
      currentExp: 50,
      enrolledVia: 'invite',
      createdAt: now,
    });
  });

  it('addStudentModuleExp throws when enrollment is missing', async () => {
    prisma.userModule.findUnique.mockResolvedValue(null);

    await expect(service.addStudentModuleExp(5, 2, 50)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('addStudentModuleExp rejects non-positive XP gains', async () => {
    await expect(service.addStudentModuleExp(5, 2, 0)).rejects.toThrow(
      BadRequestException,
    );
  });
});
