import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ModuleUnitStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test/test-helpers';
import { runCrudServiceTests } from '../../test/test-helpers';
import { ModuleUnitQuestionGroupService } from './module-unit-question-group.service';

runCrudServiceTests({
  name: 'ModuleUnitQuestionGroupService',
  service: ModuleUnitQuestionGroupService,
  modelName: 'moduleUnitQuestionGroup',
  entityLabel: 'ModuleUnitQuestionGroup',
  createDto: {
    moduleUnitId: 1,
    name: 'Group 1',
    sortOrder: 1,
  },
  formatCreateData: (dto) => ({
    ...dto,
    isArchived: false,
  }),
  updateDto: {
    name: 'Updated Group',
  },
});

describe('ModuleUnitQuestionGroupService.renameScoped', () => {
  let service: ModuleUnitQuestionGroupService;
  const prisma = createPrismaMock();

  beforeEach(() => {
    service = new ModuleUnitQuestionGroupService(
      prisma as unknown as PrismaService,
    );
    jest.resetAllMocks();
  });

  it('renames a scoped group with trimmed title', async () => {
    prisma.moduleUnitQuestionGroup.findUnique.mockResolvedValue({
      id: 8,
      moduleUnitId: 3,
      name: 'Group 3',
      sortOrder: 3,
      isArchived: false,
      moduleUnit: { id: 3, moduleId: 2 },
    } as any);
    prisma.moduleUnitQuestionGroup.findFirst.mockResolvedValue(null);
    prisma.moduleUnitQuestionGroup.update.mockResolvedValue({
      id: 8,
      moduleUnitId: 3,
      name: 'Exam Review',
      sortOrder: 3,
      isArchived: false,
    } as any);

    const result = await service.renameScoped(2, 3, 8, '  Exam Review  ');

    expect(prisma.moduleUnitQuestionGroup.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { name: 'Exam Review' },
    });
    expect(prisma.moduleUnitQuestionGroup.findFirst).toHaveBeenCalledWith({
      where: {
        moduleUnitId: 3,
        isArchived: false,
        name: 'Exam Review',
        id: { not: 8 },
      },
      select: { id: true },
    });
    expect(result.name).toBe('Exam Review');
  });

  it('throws NotFoundException when group is outside scope', async () => {
    prisma.moduleUnitQuestionGroup.findUnique.mockResolvedValue(null);

    await expect(service.renameScoped(2, 3, 8, 'Renamed')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.moduleUnitQuestionGroup.update).not.toHaveBeenCalled();
  });

  it('maps unique constraint violations to ConflictException', async () => {
    prisma.moduleUnitQuestionGroup.findUnique.mockResolvedValue({
      id: 8,
      moduleUnitId: 3,
      name: 'Group 3',
      sortOrder: 3,
      isArchived: false,
      moduleUnit: { id: 3, moduleId: 2 },
    } as any);
    prisma.moduleUnitQuestionGroup.findFirst.mockResolvedValue(null);
    prisma.moduleUnitQuestionGroup.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        clientVersion: 'test',
        code: 'P2002',
      }),
    );

    await expect(service.renameScoped(2, 3, 8, 'Group 1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('archives a scoped group when unit is live', async () => {
    prisma.moduleUnitQuestionGroup.findUnique.mockResolvedValue({
      id: 11,
      moduleUnitId: 3,
      name: 'Group 2',
      sortOrder: 2,
      isArchived: false,
      moduleUnit: { id: 3, moduleId: 2, status: ModuleUnitStatus.live },
    } as any);
    prisma.questionAttempt.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    prisma.questionUnit.updateMany.mockResolvedValue({ count: 2 } as any);
    prisma.questionContent.updateMany.mockResolvedValue({ count: 4 } as any);
    prisma.moduleUnitQuestionGroup.update.mockResolvedValue({
      id: 11,
      isArchived: true,
    } as any);

    await service.removeScoped(2, 3, 11);

    expect(prisma.moduleUnitQuestionGroup.delete).not.toHaveBeenCalled();
    expect(prisma.moduleUnitQuestionGroup.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { isArchived: true },
    });
  });

  it('hard deletes a scoped group when draft and no attempts', async () => {
    prisma.moduleUnitQuestionGroup.findUnique.mockResolvedValue({
      id: 11,
      moduleUnitId: 3,
      name: 'Group 2',
      sortOrder: 2,
      isArchived: false,
      moduleUnit: { id: 3, moduleId: 2, status: ModuleUnitStatus.draft },
    } as any);
    prisma.questionAttempt.count.mockResolvedValue(0);
    prisma.questionUnit.deleteMany.mockResolvedValue({ count: 2 } as any);
    prisma.moduleUnitQuestionGroup.delete.mockResolvedValue({ id: 11 } as any);

    await service.removeScoped(2, 3, 11);

    expect(prisma.questionUnit.deleteMany).toHaveBeenCalledWith({
      where: { questionGroupId: 11, moduleUnitId: 3 },
    });
    expect(prisma.moduleUnitQuestionGroup.delete).toHaveBeenCalledWith({
      where: { id: 11 },
    });
  });
});

describe('ModuleUnitQuestionGroupService.createScoped', () => {
  let service: ModuleUnitQuestionGroupService;
  const prisma = createPrismaMock();

  beforeEach(() => {
    service = new ModuleUnitQuestionGroupService(
      prisma as unknown as PrismaService,
    );
    jest.resetAllMocks();
  });

  it('creates a scoped group with trimmed name', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 3,
      moduleId: 2,
    } as any);
    prisma.moduleUnitQuestionGroup.findFirst.mockResolvedValue(null);
    prisma.moduleUnitQuestionGroup.create.mockResolvedValue({
      id: 10,
      moduleUnitId: 3,
      name: 'Test Group',
      sortOrder: 1,
      isArchived: false,
    } as any);

    const dto = { moduleUnitId: 3, name: '  Test Group  ', sortOrder: 1 };
    const result = await service.createScoped(2, 3, dto);

    expect(prisma.moduleUnitQuestionGroup.create).toHaveBeenCalledWith({
      data: {
        moduleUnitId: 3,
        name: 'Test Group',
        sortOrder: 1,
        isArchived: false,
      },
    });
    expect(result.name).toBe('Test Group');
  });

  it('throws NotFoundException when module unit is outside scope', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 3,
      moduleId: 5,
    } as any);

    const dto = { moduleUnitId: 3, name: 'Group', sortOrder: 1 };
    await expect(service.createScoped(2, 3, dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException on moduleUnitId mismatch', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 3,
      moduleId: 2,
    } as any);

    const dto = { moduleUnitId: 4, name: 'Group', sortOrder: 1 };
    await expect(service.createScoped(2, 3, dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws ConflictException for duplicate name in unit', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 3,
      moduleId: 2,
    } as any);
    prisma.moduleUnitQuestionGroup.findFirst.mockResolvedValue({
      id: 8,
    } as any);

    const dto = { moduleUnitId: 3, name: 'Existing Group', sortOrder: 1 };
    await expect(service.createScoped(2, 3, dto)).rejects.toThrow(
      ConflictException,
    );
  });
});
