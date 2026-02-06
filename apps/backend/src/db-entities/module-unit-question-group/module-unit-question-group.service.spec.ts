import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
      moduleUnit: { id: 3, moduleId: 2 },
    } as any);
    prisma.moduleUnitQuestionGroup.update.mockResolvedValue({
      id: 8,
      moduleUnitId: 3,
      name: 'Exam Review',
      sortOrder: 3,
    } as any);

    const result = await service.renameScoped(2, 3, 8, '  Exam Review  ');

    expect(prisma.moduleUnitQuestionGroup.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { name: 'Exam Review' },
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
      moduleUnit: { id: 3, moduleId: 2 },
    } as any);
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
});
