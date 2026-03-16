import { runCrudServiceTests } from '../../test/test-helpers';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  QuestTypeValues,
  type QuestHistoryResponse,
} from '@scholarxp/api-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';
import { DailyQuestService } from './daily-quest.service';

runCrudServiceTests({
  name: 'DailyQuestService',
  service: DailyQuestService,
  modelName: 'dailyQuest',
  entityLabel: 'DailyQuest',
  createDto: {
    moduleId: 1,
    userId: 2,
    type: QuestTypeValues.completeDailyPractice,
    expGranted: 50,
    isCompleted: false,
  },
  updateDto: {
    isCompleted: true,
  },
  existingRecord: {
    id: 42,
    moduleId: 1,
    moduleUnitId: null,
    userId: 2,
    type: QuestTypeValues.completeDailyPractice,
    expGranted: 50,
    isCompleted: false,
    questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
    generatedAt: new Date('2026-02-19T00:00:00.000Z'),
    completedAt: null,
  },
});

describe('DailyQuestService quest target validation', () => {
  let prisma: PrismaMock;
  let moduleRef: TestingModule;
  let service: DailyQuestService;

  beforeEach(async () => {
    prisma = createPrismaMock();
    moduleRef = await Test.createTestingModule({
      providers: [
        DailyQuestService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(DailyQuestService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rejects module-scoped quest types when moduleId is missing', async () => {
    await expect(
      service.create({
        userId: 22,
        type: QuestTypeValues.completeNewUnit,
        expGranted: 15,
        questDateUtc: '2026-02-19',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.dailyQuest.create).not.toHaveBeenCalled();
  });

  it('rejects module-unit targets for module-level quest types', async () => {
    await expect(
      service.create({
        moduleId: 11,
        moduleUnitId: 44,
        userId: 22,
        type: QuestTypeValues.completeDailyPractice,
        expGranted: 15,
        questDateUtc: '2026-02-19',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.moduleUnit.findUnique).not.toHaveBeenCalled();
    expect(prisma.dailyQuest.create).not.toHaveBeenCalled();
  });

  it('creates complete_new_unit quests when the quest targets a module', async () => {
    prisma.dailyQuest.create.mockResolvedValue({
      id: 100,
      moduleId: 11,
      moduleUnitId: null,
      userId: 22,
      type: QuestTypeValues.completeNewUnit,
      expGranted: 15,
      isCompleted: false,
      questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
      generatedAt: new Date('2026-02-19T00:00:00.000Z'),
      completedAt: null,
    });

    await service.create({
      moduleId: 11,
      userId: 22,
      type: QuestTypeValues.completeNewUnit,
      expGranted: 15,
      questDateUtc: '2026-02-19',
    });

    expect(prisma.moduleUnit.findUnique).not.toHaveBeenCalled();
    expect(prisma.dailyQuest.create).toHaveBeenCalled();
  });

  it('creates module_unit_retry quests when the quest targets a module', async () => {
    prisma.dailyQuest.create.mockResolvedValue({
      id: 101,
      moduleId: 11,
      moduleUnitId: null,
      userId: 22,
      type: QuestTypeValues.moduleUnitRetry,
      expGranted: 50,
      isCompleted: false,
      questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
      generatedAt: new Date('2026-02-19T00:00:00.000Z'),
      completedAt: null,
    });

    await service.create({
      moduleId: 11,
      userId: 22,
      type: QuestTypeValues.moduleUnitRetry,
      expGranted: 50,
      questDateUtc: '2026-02-19',
    });

    expect(prisma.moduleUnit.findUnique).not.toHaveBeenCalled();
    expect(prisma.dailyQuest.create).toHaveBeenCalled();
  });

  it('rejects master quests when a module target is provided', async () => {
    await expect(
      service.create({
        moduleId: 11,
        userId: 22,
        type: QuestTypeValues.masterDailyQuests,
        expGranted: 250,
        questDateUtc: '2026-02-19',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.dailyQuest.create).not.toHaveBeenCalled();
  });

  it('maps shared tier and progress fields when listing quest history', async () => {
    prisma.dailyQuest.groupBy.mockResolvedValue([
      {
        questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
      },
    ]);
    prisma.dailyQuest.findMany.mockResolvedValue([
      {
        id: 100,
        moduleId: 11,
        moduleUnitId: null,
        userId: 22,
        type: QuestTypeValues.dailyPracticeStreak,
        expGranted: 50,
        isCompleted: false,
        questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
        generatedAt: new Date('2026-02-19T00:00:00.000Z'),
        completedAt: null,
        module: {
          title: 'Biology',
        },
        moduleUnit: null,
      },
    ]);

    const response = await service.listHistoryForUser(22, {});

    expect(response).toEqual<QuestHistoryResponse>({
      quests: [
        {
          id: 100,
          moduleId: 11,
          moduleUnitId: null,
          moduleTitle: 'Biology',
          moduleUnitTitle: null,
          type: QuestTypeValues.dailyPracticeStreak,
          tier: 'daily',
          expGranted: 50,
          isCompleted: false,
          progressCurrent: 0,
          progressTarget: 3,
          description: 'Reach a 30% streak in the Biology daily practice set.',
          questDateUtc: '2026-02-19',
          generatedAt: '2026-02-19T00:00:00.000Z',
          completedAt: null,
        },
      ],
      hasMore: false,
      nextDayOffset: null,
    });
  });
});
