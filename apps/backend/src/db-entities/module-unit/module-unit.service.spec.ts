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

  it('creates a module unit with defaults, next sort order, and Group 1 starter group', async () => {
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
      name: 'Group 1',
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
    prisma.moduleUnitQuestionGroup.create.mockResolvedValue(
      createdGroup as any,
    );

    const result = await service.createForModule(moduleId, {
      title: 'New Unit',
    });

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
        name: 'Group 1',
        sortOrder: 1,
      },
    });
    expect(result).toEqual({
      ...createdUnit,
      questionGroups: [
        {
          id: createdGroup.id,
          moduleUnitId: createdUnit.id,
          name: 'Group 1',
          sortOrder: 1,
        },
      ],
    });
  });
});

describe('ModuleUnitService.findByModule', () => {
  let service: ModuleUnitService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ModuleUnitService(prisma as unknown as PrismaService);
  });

  it('derives questionCount from active questions in each unit', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([
      {
        id: 1,
        moduleId: 77,
        variantContext: '',
        title: 'Unit A',
        questionCount: 999,
        status: ModuleUnitStatus.draft,
        sortOrder: 1,
        createdAt: new Date(),
        questionGroups: [
          { id: 11, moduleUnitId: 1, name: 'Group 1', sortOrder: 1 },
        ],
        questionUnits: [
          { id: 101, title: 'Q1', questionGroupId: 11 },
          { id: 102, title: 'Q2', questionGroupId: 11 },
        ],
        userProgress: [],
      },
      {
        id: 2,
        moduleId: 77,
        variantContext: '',
        title: 'Unit B',
        questionCount: 999,
        status: ModuleUnitStatus.live,
        sortOrder: 2,
        createdAt: new Date(),
        questionGroups: [],
        questionUnits: [{ id: 201, title: 'Q3', questionGroupId: null }],
        userProgress: [],
      },
    ] as any);

    const result = await service.findByModule(77);

    expect(prisma.moduleUnit.findMany).toHaveBeenCalledWith({
      where: { moduleId: 77 },
      orderBy: { sortOrder: 'asc' },
      include: {
        questionGroups: {
          where: { isArchived: false },
          orderBy: { sortOrder: 'asc' },
        },
        questionUnits: {
          where: { isArchived: false },
          select: { id: true, title: true, questionGroupId: true },
        },
        userProgress: {
          where: { studentId: -1 },
          select: { isCompleted: true },
        },
      },
    });
    expect(result[0]?.questionCount).toBe(2);
    expect(result[1]?.questionCount).toBe(1);
    expect(result[0]?.isCompleted).toBe(false);
    expect(result[1]?.isCompleted).toBe(false);
  });

  it('maps latest student attempts into grouped question status values', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([
      {
        id: 1,
        moduleId: 77,
        variantContext: '',
        title: 'Unit A',
        questionCount: 0,
        status: ModuleUnitStatus.live,
        sortOrder: 1,
        createdAt: new Date(),
        questionGroups: [
          { id: 11, moduleUnitId: 1, name: 'Group 1', sortOrder: 1 },
        ],
        questionUnits: [
          { id: 101, title: 'Q1', questionGroupId: 11 },
          { id: 102, title: 'Q2', questionGroupId: 11 },
        ],
        userProgress: [{ isCompleted: true }],
      },
    ] as any);
    prisma.questionAttempt.findMany.mockResolvedValue([
      {
        moduleUnitId: 1,
        questionId: 102,
        isCorrect: false,
        attemptedAt: new Date(),
        id: 2,
      },
      {
        moduleUnitId: 1,
        questionId: 101,
        isCorrect: true,
        attemptedAt: new Date(),
        id: 1,
      },
    ] as any);
    prisma.expLedger.groupBy.mockResolvedValue([] as any);

    const result = await service.findByModule(77, 42);

    expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
      where: {
        moduleUnitId: { in: [1] },
        studentId: 42,
        session: {
          is: {
            sessionType: {
              in: ['practice_room', 'view_answers'],
            },
          },
        },
      },
      orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
      select: {
        moduleUnitId: true,
        questionId: true,
        isCorrect: true,
      },
    });
    expect(prisma.moduleUnit.findMany).toHaveBeenCalledWith({
      where: { moduleId: 77 },
      orderBy: { sortOrder: 'asc' },
      include: {
        questionGroups: {
          where: { isArchived: false },
          orderBy: { sortOrder: 'asc' },
        },
        questionUnits: {
          where: { isArchived: false },
          select: { id: true, title: true, questionGroupId: true },
        },
        userProgress: {
          where: { studentId: 42 },
          select: { isCompleted: true },
        },
      },
    });
    expect(result[0]?.questionGroups[0]?.questions).toEqual([
      { id: 101, title: 'Q1', lastAttemptResult: 'correct' },
      { id: 102, title: 'Q2', lastAttemptResult: 'incorrect' },
    ]);
    expect(result[0]?.isCompleted).toBe(true);
  });

  it('ignores retry and daily-practice attempts when deriving student card question status', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([
      {
        id: 1,
        moduleId: 77,
        variantContext: '',
        title: 'Unit A',
        questionCount: 0,
        status: ModuleUnitStatus.live,
        sortOrder: 1,
        createdAt: new Date(),
        questionGroups: [
          { id: 11, moduleUnitId: 1, name: 'Group 1', sortOrder: 1 },
        ],
        questionUnits: [{ id: 101, title: 'Q1', questionGroupId: 11 }],
        userProgress: [{ isCompleted: true }],
      },
    ] as any);
    prisma.questionAttempt.findMany.mockResolvedValue([
      {
        moduleUnitId: 1,
        questionId: 101,
        isCorrect: true,
      },
    ] as any);
    prisma.expLedger.groupBy.mockResolvedValue([] as any);

    const result = await service.findByModule(77, 42);

    expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: {
            is: {
              sessionType: {
                in: ['practice_room', 'view_answers'],
              },
            },
          },
        }),
      }),
    );
    expect(result[0]?.questionGroups[0]?.questions).toEqual([
      { id: 101, title: 'Q1', lastAttemptResult: 'correct' },
    ]);
  });
});

describe('ModuleUnitService.findEditorPayload', () => {
  let service: ModuleUnitService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ModuleUnitService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException when module unit is outside scope', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 3,
      moduleId: 1,
      title: 'Unit',
      questionGroups: [],
      questionUnits: [],
    } as any);

    await expect(service.findEditorPayload(2, 3)).rejects.toThrow(
      'Module unit not found',
    );
  });

  it('returns unit payload when scope matches', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 3,
      moduleId: 2,
      title: 'Unit',
      variantContext: '',
      questionGroups: [{ id: 1, name: 'G1', sortOrder: 1, moduleUnitId: 3 }],
      questionUnits: [
        {
          id: 101,
          title: 'Q1',
          questionGroupId: 1,
          contents: [
            {
              id: 55,
              isCore: true,
              type: 'mcq',
              questionStem: '...',
              questionData: {},
              isArchived: false,
            },
          ],
          variants: [],
          isArchived: false,
        },
      ],
    } as any);

    const result = await service.findEditorPayload(2, 3);
    expect(result.id).toBe(3);
    expect(result.moduleId).toBe(2);
  });
});
