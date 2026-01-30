// Tests for UserModuleService ensuring module-scoped listing.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserModuleService } from './user-module.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';
import { GlobalRole } from '@prisma/client';

describe('UserModuleService', () => {
  let prisma: PrismaMock;
  let service: UserModuleService;
  const teacher = {
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

    await service.findAll(5, teacher);

    expect(prisma.userModule.findMany).toHaveBeenCalledWith({
      where: { moduleId: 5 },
    });
  });

  it('findAll returns all when moduleId omitted', async () => {
    prisma.userModule.findMany.mockResolvedValue([]);

    await service.findAll(undefined, teacher);

    expect(prisma.userModule.findMany).toHaveBeenCalledWith();
  });

  it('findOne throws when missing', async () => {
    prisma.userModule.findUnique.mockResolvedValue(null);

    await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks roster actions when permission denied', () => {
    const noAccess = { ...teacher, globalRole: GlobalRole.student };
    expect(() =>
      service.create({ moduleId: 1, userId: 2 } as any, noAccess),
    ).toThrow(ForbiddenException);
  });
});
