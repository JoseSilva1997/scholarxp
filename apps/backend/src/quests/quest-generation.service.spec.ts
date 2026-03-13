// Role: verifies daily quest generation stays deterministic and easy to evolve as quest-slot rules change.
import { Test, TestingModule } from '@nestjs/testing';
import { QuestTypeValues } from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { QuestGenerationService } from './quest-generation.service';

describe('QuestGenerationService', () => {
  let service: QuestGenerationService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.dailyQuest.createMany.mockResolvedValue({ count: 4 } as never);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuestGenerationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(QuestGenerationService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates three daily quests and the master quest when a new lesson is available', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findFirst.mockResolvedValue({
      moduleId: 1,
    } as never);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 1 }] as never);
    prisma.moduleUnit.findFirst.mockResolvedValue({
      moduleId: 1,
    } as never);

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-13T12:30:00.000Z'),
    );

    expect(prisma.dailyQuest.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeDailyPractice,
          expGranted: 50,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        }),
        expect.objectContaining({
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.dailyPracticeStreak,
          expGranted: 50,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        }),
        expect.objectContaining({
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        }),
        expect.objectContaining({
          userId: 42,
          moduleId: null,
          moduleUnitId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 250,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        }),
      ],
      skipDuplicates: true,
    });
    expect(prisma.moduleUnit.findFirst).toHaveBeenCalledWith({
      where: {
        moduleId: {
          in: [1],
        },
        status: 'live',
        questionUnits: {
          some: {
            isArchived: false,
          },
        },
        userProgress: {
          none: {
            studentId: 42,
            isCompleted: true,
          },
        },
      },
      orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        moduleId: true,
      },
    });
  });

  it('falls back to a retry lesson quest when no new lesson remains', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findFirst.mockResolvedValue({
      moduleId: 2,
    } as never);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 2 }] as never);
    prisma.moduleUnit.findFirst.mockResolvedValue(null);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      moduleUnit: {
        moduleId: 2,
      },
    } as never);

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-13T12:30:00.000Z'),
    );

    expect(prisma.dailyQuest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: QuestTypeValues.moduleUnitRetry,
          moduleId: 2,
          moduleUnitId: null,
          expGranted: 50,
        }),
      ]),
      skipDuplicates: true,
    });
    expect(prisma.moduleUnitUserProgress.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 42,
        isCompleted: true,
        moduleUnit: {
          moduleId: {
            in: [2],
          },
          status: 'live',
          questionUnits: {
            some: {
              isArchived: false,
            },
          },
        },
      },
      orderBy: [{ completedAt: 'asc' }, { moduleUnitId: 'asc' }],
      select: {
        moduleUnit: {
          select: {
            moduleId: true,
          },
        },
      },
    });
  });

  it('anchors all generated daily quests to the eligible lesson module when the first enrolled module has no units', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findFirst.mockResolvedValue({
      moduleId: 1,
    } as never);
    prisma.userModule.findMany.mockResolvedValue([
      { moduleId: 1 },
      { moduleId: 2 },
    ] as never);
    prisma.moduleUnit.findFirst.mockResolvedValue({
      moduleId: 2,
    } as never);

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-13T12:30:00.000Z'),
    );

    expect(prisma.dailyQuest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: QuestTypeValues.completeDailyPractice,
          moduleId: 2,
        }),
        expect.objectContaining({
          type: QuestTypeValues.dailyPracticeStreak,
          moduleId: 2,
        }),
        expect.objectContaining({
          type: QuestTypeValues.completeNewUnit,
          moduleId: 2,
        }),
        expect.objectContaining({
          type: QuestTypeValues.masterDailyQuests,
          moduleId: null,
        }),
      ]),
      skipDuplicates: true,
    });
  });
});
