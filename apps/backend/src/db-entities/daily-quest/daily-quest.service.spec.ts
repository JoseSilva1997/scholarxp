import { runCrudServiceTests } from '../../test/test-helpers';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QuestTypeValues } from '@scholarxp/api-contracts';
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
    type: 'practice',
    expGranted: 10,
    isCompleted: false,
  },
  updateDto: {
    isCompleted: true,
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

  it('rejects complete_new_unit quests when moduleUnitId is missing', async () => {
    await expect(
      service.create({
        moduleId: 11,
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

  it('creates complete_new_unit quests when the targeted module unit belongs to the module', async () => {
    prisma.moduleUnit.findUnique.mockResolvedValue({
      id: 44,
      moduleId: 11,
      variantContext: null,
      title: 'Lesson 1',
      questionCount: 4,
      status: 'live',
      sortOrder: 1,
      createdAt: new Date('2026-02-19T00:00:00.000Z'),
    });
    prisma.dailyQuest.create.mockResolvedValue({
      id: 100,
      moduleId: 11,
      moduleUnitId: 44,
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
      moduleUnitId: 44,
      userId: 22,
      type: QuestTypeValues.completeNewUnit,
      expGranted: 15,
      questDateUtc: '2026-02-19',
    });

    expect(prisma.moduleUnit.findUnique).toHaveBeenCalledWith({
      where: { id: 44 },
      select: { moduleId: true },
    });
    expect(prisma.dailyQuest.create).toHaveBeenCalled();
  });
});
