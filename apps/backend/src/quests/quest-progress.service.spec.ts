// Role: verifies quest completion events stay aligned with the product triggers for daily revision, new-unit completion, and retry review.
import { Test, TestingModule } from '@nestjs/testing';
import { QuestTypeValues } from '@scholarxp/api-contracts';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { QuestGenerationService } from './quest-generation.service';
import { QuestProgressService } from './quest-progress.service';
import { QuestStreakService } from './quest-streak.service';

describe('QuestProgressService', () => {
  let service: QuestProgressService;
  let prisma: PrismaMock;
  let questGenerationService: {
    ensureQuestDayGeneratedForUser: jest.Mock;
  };
  let expLedgerService: {
    recordEvent: jest.Mock;
  };
  let avatarService: {
    addStudentExp: jest.Mock;
  };
  let questStreakService: {
    getRewardForNextMasterQuestCompletion: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    questGenerationService = {
      ensureQuestDayGeneratedForUser: jest.fn().mockResolvedValue(undefined),
    };
    expLedgerService = {
      recordEvent: jest
        .fn()
        .mockImplementation(async ({ awardedExp }: { awardedExp: number }) => ({
          created: true,
          awardedExp,
        })),
    };
    avatarService = {
      addStudentExp: jest.fn().mockResolvedValue({ id: 1, totalExp: 400 }),
    };
    questStreakService = {
      getRewardForNextMasterQuestCompletion: jest.fn().mockResolvedValue({
        streakCount: 1,
        bonusPercent: 10,
        awardedExp: 275,
      }),
    };
    prisma.dailyQuest.updateMany.mockResolvedValue({ count: 1 } as never);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuestProgressService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: QuestGenerationService,
          useValue: questGenerationService,
        },
        {
          provide: ExpLedgerService,
          useValue: expLedgerService,
        },
        {
          provide: AvatarService,
          useValue: avatarService,
        },
        {
          provide: QuestStreakService,
          useValue: questStreakService,
        },
      ],
    }).compile();

    service = moduleRef.get(QuestProgressService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('completes daily practice first, then streak, then master on the second daily revision click', async () => {
    prisma.dailyQuest.findMany
      .mockResolvedValueOnce([
        {
          id: 1,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeDailyPractice,
          expGranted: 50,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 2,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.dailyPracticeStreak,
          expGranted: 50,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 3,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 4,
          userId: 42,
          moduleId: null,
          moduleUnitId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 250,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 1,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeDailyPractice,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 2,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.dailyPracticeStreak,
          expGranted: 50,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 3,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 4,
          userId: 42,
          moduleId: null,
          moduleUnitId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 250,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 1,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeDailyPractice,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 2,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.dailyPracticeStreak,
          expGranted: 50,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 3,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 4,
          userId: 42,
          moduleId: null,
          moduleUnitId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 250,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 1,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeDailyPractice,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 2,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.dailyPracticeStreak,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 3,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 4,
          userId: 42,
          moduleId: null,
          moduleUnitId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 250,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
      ] as never);

    await service.recordDailyRevisionButtonClick(
      {
        userId: 42,
        moduleId: 1,
        clickedAt: new Date('2026-03-13T09:10:00.000Z'),
      },
      prisma,
    );

    await service.recordDailyRevisionButtonClick(
      {
        userId: 42,
        moduleId: 1,
        clickedAt: new Date('2026-03-13T09:12:00.000Z'),
      },
      prisma,
    );

    expect(prisma.dailyQuest.updateMany).toHaveBeenCalledTimes(3);
    expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(3);
    expect(avatarService.addStudentExp).toHaveBeenCalledTimes(3);
    expect(avatarService.addStudentExp).toHaveBeenNthCalledWith(
      1,
      42,
      50,
      prisma,
    );
    expect(avatarService.addStudentExp).toHaveBeenNthCalledWith(
      2,
      42,
      50,
      prisma,
    );
    expect(avatarService.addStudentExp).toHaveBeenNthCalledWith(
      3,
      42,
      275,
      prisma,
    );
    expect(
      questStreakService.getRewardForNextMasterQuestCompletion,
    ).toHaveBeenCalledWith(42, new Date('2026-03-13T09:12:00.000Z'), prisma);
  });

  it('completes the module-scoped new unit quest when a completion ledger event exists for the module', async () => {
    prisma.dailyQuest.findMany
      .mockResolvedValueOnce([
        {
          id: 10,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 11,
          userId: 42,
          moduleId: null,
          moduleUnitId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 250,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 10,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.completeNewUnit,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
        {
          id: 11,
          userId: 42,
          moduleId: null,
          moduleUnitId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: 250,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
      ] as never);
    prisma.expLedger.findFirst.mockResolvedValue({ id: 'ledger-1' } as never);

    await service.recordModuleUnitCompletion(
      {
        userId: 42,
        moduleId: 1,
        completedAt: new Date('2026-03-13T09:10:00.000Z'),
      },
      prisma,
    );

    expect(prisma.dailyQuest.updateMany).toHaveBeenCalledTimes(1);
    expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(1);
    expect(avatarService.addStudentExp).toHaveBeenCalledWith(42, 50, prisma);
  });

  it('completes the retry quest when answers are viewed for an already completed unit', async () => {
    prisma.dailyQuest.findMany
      .mockResolvedValueOnce([
        {
          id: 21,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.moduleUnitRetry,
          expGranted: 50,
          isCompleted: false,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 21,
          userId: 42,
          moduleId: 1,
          moduleUnitId: null,
          type: QuestTypeValues.moduleUnitRetry,
          expGranted: 50,
          isCompleted: true,
          questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
        },
      ] as never);
    prisma.moduleUnitUserProgress.findUnique.mockResolvedValue({
      isCompleted: true,
    } as never);

    await service.recordCompletedUnitReview(
      {
        userId: 42,
        moduleId: 1,
        moduleUnitId: 10,
        viewedAt: new Date('2026-03-13T09:10:00.000Z'),
      },
      prisma,
    );

    expect(prisma.dailyQuest.updateMany).toHaveBeenCalledTimes(1);
    expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(1);
    expect(avatarService.addStudentExp).toHaveBeenCalledWith(42, 50, prisma);
  });
});
