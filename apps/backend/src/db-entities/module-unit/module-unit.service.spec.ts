import { runCrudServiceTests } from '../../test/test-helpers';
import { ModuleUnitService } from './module-unit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test/test-helpers';
import { ModuleUnitStatus } from '@prisma/client';

runCrudServiceTests({
  name: 'ModuleUnitService',
  service: ModuleUnitService,
  modelName: 'moduleUnit',
  entityLabel: 'ModuleUnit',
  createDto: {
    moduleId: 1,
    variantContext: 'ctx',
    title: 'Unit 1',
    questionCount: 3,
    status: 'draft' as any,
    sortOrder: 1,
  },
  updateDto: {
    title: 'Updated Unit',
  },
});

describe('ModuleUnitService.createForModule', () => {
  let service: ModuleUnitService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ModuleUnitService(prisma as unknown as PrismaService);
  });

  it('creates a module unit with defaults, next sort order, and default group', async () => {
    const moduleId = 7;
    const nextSortOrder = 3;
    const createdUnit = {
      id: 10,
      moduleId,
      variantContext: '',
      title: 'New Unit',
      questionCount: 0,
      status: ModuleUnitStatus.draft,
      sortOrder: nextSortOrder,
      createdAt: new Date(),
    };
    const createdGroup = {
      id: 99,
      moduleUnitId: createdUnit.id,
      name: 'default',
      sortOrder: 1,
    };

    prisma.moduleUnit.aggregate.mockResolvedValue({
      _count: null,
      _avg: null,
      _sum: null,
      _min: null,
      _max: { sortOrder: 2 },
    } as any);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma as any),
    );
    prisma.moduleUnit.create.mockResolvedValue(createdUnit as any);
    prisma.moduleUnitQuestionGroup.create.mockResolvedValue(createdGroup as any);

    const result = await service.createForModule(moduleId, { title: 'New Unit' });

    expect(prisma.moduleUnit.aggregate).toHaveBeenCalledWith({
      where: { moduleId },
      _max: { sortOrder: true },
    });
    expect(prisma.moduleUnit.create).toHaveBeenCalledWith({
      data: {
        moduleId,
        variantContext: '',
        title: 'New Unit',
        questionCount: 0,
        status: ModuleUnitStatus.draft,
        sortOrder: nextSortOrder,
      },
    });
    expect(prisma.moduleUnitQuestionGroup.create).toHaveBeenCalledWith({
      data: {
        moduleUnitId: createdUnit.id,
        name: 'default',
        sortOrder: 1,
      },
    });
    expect(result).toEqual({
      ...createdUnit,
      questionGroups: [
        {
          id: createdGroup.id,
          moduleUnitId: createdUnit.id,
          name: 'default',
          sortOrder: 1,
        },
      ],
    });
  });
});
