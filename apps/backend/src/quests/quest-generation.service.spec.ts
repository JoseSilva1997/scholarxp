// Role: verifies daily quest generation stays deterministic and easy to evolve as quest-slot rules change.
import { Test, TestingModule } from '@nestjs/testing';
import { QuestTypeValues } from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { QuestDailyPracticeAvailabilityService } from './quest-daily-practice-availability.service';
import { QuestGenerationService } from './quest-generation.service';

describe('QuestGenerationService', () => {
  let service: QuestGenerationService;
  let prisma: PrismaMock;
  let questDailyPracticeAvailabilityService: {
    findFirstAvailableModuleId: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    questDailyPracticeAvailabilityService = {
      findFirstAvailableModuleId: jest.fn().mockResolvedValue(1),
    };
    prisma.dailyQuest.createMany.mockResolvedValue({ count: 4 } as never);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuestGenerationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: QuestDailyPracticeAvailabilityService,
          useValue: questDailyPracticeAvailabilityService,
        },
      ],
    }).compile();

    service = moduleRef.get(QuestGenerationService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates three daily quests and the master quest when a new lesson is available', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 1 }] as never);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      moduleUnit: {
        moduleId: 1,
      },
    } as never);
    prisma.moduleUnit.findFirst.mockResolvedValue({
      moduleId: 1,
    } as never);
    questDailyPracticeAvailabilityService.findFirstAvailableModuleId.mockResolvedValue(
      1,
    );

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
    expect(prisma.moduleUnitUserProgress.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 42,
        isCompleted: true,
        completedAt: {
          lt: new Date('2026-03-13T00:00:00.000Z'),
        },
        moduleUnit: {
          moduleId: {
            in: [1],
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

  it('falls back to a retry lesson quest when no new lesson remains', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 2 }] as never);
    prisma.moduleUnit.findFirst.mockResolvedValue(null);
    prisma.moduleUnitUserProgress.findFirst
      .mockResolvedValueOnce({
        moduleUnit: {
          moduleId: 2,
        },
      } as never)
      .mockResolvedValueOnce({
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
    expect(prisma.moduleUnitUserProgress.findFirst).toHaveBeenNthCalledWith(2, {
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
    prisma.userModule.findMany.mockResolvedValue([
      { moduleId: 1 },
      { moduleId: 2 },
    ] as never);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      moduleUnit: {
        moduleId: 2,
      },
    } as never);
    prisma.moduleUnit.findFirst.mockResolvedValue({
      moduleId: 2,
    } as never);
    questDailyPracticeAvailabilityService.findFirstAvailableModuleId.mockResolvedValue(
      2,
    );

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

  it('does not generate quests until the student has completed their first module unit', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 7 }] as never);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue(null);

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-13T12:30:00.000Z'),
    );

    expect(prisma.moduleUnit.findFirst).not.toHaveBeenCalled();
    expect(prisma.dailyQuest.createMany).not.toHaveBeenCalled();
  });

  it('does not generate quests on the same UTC day as the first completed module unit', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 7 }] as never);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue(null);

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-13T12:30:00.000Z'),
    );

    expect(prisma.moduleUnitUserProgress.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 42,
        isCompleted: true,
        completedAt: {
          lt: new Date('2026-03-13T00:00:00.000Z'),
        },
        moduleUnit: {
          moduleId: {
            in: [7],
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
    expect(prisma.dailyQuest.createMany).not.toHaveBeenCalled();
  });

  it('starts generating quests from the next UTC day after the first completed module unit', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 7 }] as never);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      moduleUnit: {
        moduleId: 7,
      },
    } as never);
    prisma.moduleUnit.findFirst.mockResolvedValue({
      moduleId: 7,
    } as never);

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-14T12:30:00.000Z'),
    );

    expect(prisma.moduleUnitUserProgress.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 42,
        isCompleted: true,
        completedAt: {
          lt: new Date('2026-03-14T00:00:00.000Z'),
        },
        moduleUnit: {
          moduleId: {
            in: [7],
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
    expect(prisma.dailyQuest.createMany).toHaveBeenCalled();
  });

  it('falls back to the first module with an available daily-practice set when the lesson quest module has none', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findMany.mockResolvedValue([
      { moduleId: 1 },
      { moduleId: 2 },
    ] as never);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      moduleUnit: {
        moduleId: 1,
      },
    } as never);
    prisma.moduleUnit.findFirst.mockResolvedValue({
      moduleId: 1,
    } as never);
    questDailyPracticeAvailabilityService.findFirstAvailableModuleId.mockResolvedValue(
      2,
    );

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-13T12:30:00.000Z'),
    );

    expect(
      questDailyPracticeAvailabilityService.findFirstAvailableModuleId,
    ).toHaveBeenCalledWith(42, [1, 2], new Date('2026-03-13T12:30:00.000Z'));
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
          moduleId: 1,
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it('still creates a master quest when daily practice is unavailable but another daily quest exists', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 1 }] as never);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      moduleUnit: {
        moduleId: 1,
      },
    } as never);
    prisma.moduleUnit.findFirst.mockResolvedValue({
      moduleId: 1,
    } as never);
    questDailyPracticeAvailabilityService.findFirstAvailableModuleId.mockResolvedValue(
      null,
    );

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-13T12:30:00.000Z'),
    );

    expect(prisma.dailyQuest.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 42,
          moduleId: 1,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
        }),
        expect.objectContaining({
          userId: 42,
          moduleId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 350,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('reconciles an existing incomplete master quest reward when the day now has three daily quests', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([
      {
        id: 1,
        type: QuestTypeValues.completeDailyPractice,
        expGranted: 50,
        isCompleted: false,
      },
      {
        id: 2,
        type: QuestTypeValues.dailyPracticeStreak,
        expGranted: 50,
        isCompleted: false,
      },
      {
        id: 3,
        type: QuestTypeValues.masterDailyQuests,
        expGranted: 300,
        isCompleted: false,
      },
    ] as never);
    prisma.userModule.findMany.mockResolvedValue([{ moduleId: 1 }] as never);
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      moduleUnit: {
        moduleId: 1,
      },
    } as never);
    prisma.moduleUnit.findFirst.mockResolvedValue({
      moduleId: 1,
    } as never);
    questDailyPracticeAvailabilityService.findFirstAvailableModuleId.mockResolvedValue(
      1,
    );

    await service.ensureQuestDayGeneratedForUser(
      42,
      new Date('2026-03-13T12:30:00.000Z'),
    );

    expect(prisma.dailyQuest.update).toHaveBeenCalledWith({
      where: {
        id: 3,
      },
      data: {
        expGranted: 250,
      },
    });
    expect(prisma.dailyQuest.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 42,
          moduleId: 1,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
        }),
      ],
      skipDuplicates: true,
    });
  });
});
