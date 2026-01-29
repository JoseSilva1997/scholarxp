// Tests for UserModuleService ensuring module-scoped listing.
import { NotFoundException } from '@nestjs/common';
import { UserModuleService } from './user-module.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';

describe('UserModuleService', () => {
  let prisma: PrismaMock;
  let service: UserModuleService;

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

    await service.findAll();

    expect(prisma.userModule.findMany).toHaveBeenCalledWith();
  });

  it('findOne throws when missing', async () => {
    prisma.userModule.findUnique.mockResolvedValue(null);

    await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
