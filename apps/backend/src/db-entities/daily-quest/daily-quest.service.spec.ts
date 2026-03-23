import { runCrudServiceTests } from '../../test/test-helpers';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  QuestTypeValues,
  type QuestHistoryResponse,
} from '@scholarxp/api-contracts';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
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
    prisma.dailyQuest.findMany
      .mockResolvedValueOnce([
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
      ] as never)
      .mockResolvedValueOnce([]);

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
          rewardBreakdown: null,
          description:
            'Achieve a streak of 3 or more during the Biology daily practice set.',
          questDateUtc: '2026-02-19',
          generatedAt: '2026-02-19T00:00:00.000Z',
          completedAt: null,
        },
      ],
      hasMore: false,
      nextDayOffset: null,
    });
  });

  it('derives the master quest target from the number of generated daily quests that day', async () => {
    prisma.dailyQuest.groupBy.mockResolvedValue([
      {
        questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
      },
    ]);
    prisma.dailyQuest.findMany
      .mockResolvedValueOnce([
        {
          id: 200,
          moduleId: 11,
          moduleUnitId: null,
          userId: 22,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
          generatedAt: new Date('2026-02-19T00:00:00.000Z'),
          completedAt: new Date('2026-02-19T08:00:00.000Z'),
          module: {
            title: 'Biology',
          },
          moduleUnit: null,
        },
        {
          id: 201,
          moduleId: null,
          moduleUnitId: null,
          userId: 22,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 300,
          isCompleted: true,
          questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
          generatedAt: new Date('2026-02-19T00:00:00.000Z'),
          completedAt: new Date('2026-02-19T08:05:00.000Z'),
          module: null,
          moduleUnit: null,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
        },
      ] as never);
    prisma.expLedger.findMany.mockResolvedValue([
      {
        questId: 201,
        awardedExp: 350,
        eventType: ExpLedgerEventTypes.COMPLETE_QUEST,
      },
    ] as never);

    const response = await service.listHistoryForUser(22, {});

    expect(response.quests[1]).toEqual({
      id: 201,
      moduleId: null,
      moduleUnitId: null,
      moduleTitle: 'Master quest',
      moduleUnitTitle: null,
      type: QuestTypeValues.masterDailyQuests,
      tier: 'master',
      expGranted: 350,
      isCompleted: true,
      progressCurrent: 1,
      progressTarget: 1,
      rewardBreakdown: {
        baseExp: 300,
        streakBonusExp: 50,
        totalExp: 350,
      },
      description:
        'Complete every daily quest available today to unlock the master quest reward.',
      questDateUtc: '2026-02-19',
      generatedAt: '2026-02-19T00:00:00.000Z',
      completedAt: '2026-02-19T08:05:00.000Z',
    });
  });

  it('projects the master quest streak bonus when the quest is still incomplete', async () => {
    prisma.dailyQuest.groupBy.mockResolvedValue([
      {
        questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
      },
    ]);
    prisma.dailyQuest.findMany
      .mockResolvedValueOnce([
        {
          id: 300,
          moduleId: 11,
          moduleUnitId: null,
          userId: 22,
          type: QuestTypeValues.completeDailyPractice,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
          generatedAt: new Date('2026-02-19T00:00:00.000Z'),
          completedAt: new Date('2026-02-19T08:00:00.000Z'),
          module: {
            title: 'Biology',
          },
          moduleUnit: null,
        },
        {
          id: 301,
          moduleId: 12,
          moduleUnitId: null,
          userId: 22,
          type: QuestTypeValues.moduleUnitRetry,
          expGranted: 50,
          isCompleted: false,
          questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
          generatedAt: new Date('2026-02-19T00:00:00.000Z'),
          completedAt: null,
          module: {
            title: 'Chemistry',
          },
          moduleUnit: null,
        },
        {
          id: 302,
          moduleId: null,
          moduleUnitId: null,
          userId: 22,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 300,
          isCompleted: false,
          questDateUtc: new Date('2026-02-19T00:00:00.000Z'),
          generatedAt: new Date('2026-02-19T00:00:00.000Z'),
          completedAt: null,
          module: null,
          moduleUnit: null,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          questDateUtc: new Date('2026-02-18T00:00:00.000Z'),
        },
        {
          questDateUtc: new Date('2026-02-17T00:00:00.000Z'),
        },
      ] as never);

    const response = await service.listHistoryForUser(22, {});

    expect(response.quests[2]).toMatchObject({
      expGranted: 350,
      rewardBreakdown: {
        baseExp: 300,
        streakBonusExp: 50,
        totalExp: 350,
      },
    });
  });
});
