// Role: verifies quest completion events stay aligned with the product triggers for daily practice, new-unit completion, and retry review.
import { Test, TestingModule } from '@nestjs/testing';
import {
  PracticeSessionTypeValues,
  QuestTypeValues,
  type QuestType,
} from '@scholarxp/api-contracts';
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
        streakCount: 0,
        bonusPercent: 0,
        awardedExp: 250,
      }),
    };
    prisma.dailyQuest.update.mockResolvedValue({
      id: 1,
      userId: 42,
      moduleId: 1,
      moduleUnitId: null,
      type: QuestTypeValues.completeDailyPractice,
      expGranted: 50,
      isCompleted: true,
      questDateUtc: new Date('2026-03-13T00:00:00.000Z'),
      generatedAt: new Date('2026-03-13T00:00:00.000Z'),
      completedAt: new Date('2026-03-13T09:10:00.000Z'),
    } as never);

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

    expect(prisma.dailyQuest.update).toHaveBeenCalledTimes(3);
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
      250,
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

    expect(prisma.dailyQuest.update).toHaveBeenCalledTimes(1);
    expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(1);
    expect(avatarService.addStudentExp).toHaveBeenCalledWith(42, 50, prisma);
  });

  it('does not complete the retry quest when a completed lesson is only viewed', async () => {
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

    expect(
      questGenerationService.ensureQuestDayGeneratedForUser,
    ).not.toHaveBeenCalled();
    expect(prisma.dailyQuest.findMany).not.toHaveBeenCalled();
    expect(prisma.dailyQuest.update).not.toHaveBeenCalled();
    expect(expLedgerService.recordEvent).not.toHaveBeenCalled();
    expect(avatarService.addStudentExp).not.toHaveBeenCalled();
  });

  it('completes the retry quest once the retry session reaches 70 percent correct answers', async () => {
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
    prisma.questionUnit.count.mockResolvedValue(10 as never);
    prisma.questionAttempt.findMany.mockResolvedValue([
      { questionId: 1 },
      { questionId: 2 },
      { questionId: 3 },
      { questionId: 4 },
      { questionId: 5 },
      { questionId: 6 },
      { questionId: 7 },
    ] as never);

    await service.recordRetrySessionProgress(
      {
        userId: 42,
        moduleId: 1,
        moduleUnitId: 10,
        sessionId: '11111111-1111-4111-8111-111111111123',
        attemptedAt: new Date('2026-03-13T09:10:00.000Z'),
      },
      prisma,
    );

    expect(prisma.questionUnit.count).toHaveBeenCalledWith({
      where: {
        moduleUnitId: 10,
        isArchived: false,
        contents: {
          some: {
            isCore: true,
            isArchived: false,
          },
        },
      },
    });
    expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
      where: {
        moduleUnitId: 10,
        studentId: 42,
        sessionId: '11111111-1111-4111-8111-111111111123',
        isCorrect: true,
      },
      select: {
        questionId: true,
      },
      distinct: ['questionId'],
    });
    expect(prisma.dailyQuest.update).toHaveBeenCalledTimes(1);
    expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(1);
    expect(avatarService.addStudentExp).toHaveBeenCalledWith(42, 50, prisma);
  });

  it('leaves the retry quest incomplete while the retry session is below the 70 percent threshold', async () => {
    prisma.dailyQuest.findMany.mockResolvedValueOnce([
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
    ] as never);
    prisma.moduleUnitUserProgress.findUnique.mockResolvedValue({
      isCompleted: true,
    } as never);
    prisma.questionUnit.count.mockResolvedValue(10 as never);
    prisma.questionAttempt.findMany.mockResolvedValue([
      { questionId: 1 },
      { questionId: 2 },
      { questionId: 3 },
      { questionId: 4 },
      { questionId: 5 },
      { questionId: 6 },
    ] as never);

    await service.recordRetrySessionProgress(
      {
        userId: 42,
        moduleId: 1,
        moduleUnitId: 10,
        sessionId: '11111111-1111-4111-8111-111111111123',
        attemptedAt: new Date('2026-03-13T09:10:00.000Z'),
      },
      prisma,
    );

    expect(prisma.dailyQuest.update).not.toHaveBeenCalled();
    expect(expLedgerService.recordEvent).not.toHaveBeenCalled();
    expect(avatarService.addStudentExp).not.toHaveBeenCalled();
  });

  it('completes the daily-practice completion quest when today set is fully answered', async () => {
    const progressedAt = new Date('2026-03-20T09:15:00.000Z');
    prisma.dailyQuest.findMany
      .mockResolvedValueOnce([
        buildQuest({
          id: 31,
          moduleId: 7,
          type: QuestTypeValues.completeDailyPractice,
          isCompleted: false,
        }),
        buildQuest({
          id: 32,
          moduleId: 7,
          type: QuestTypeValues.dailyPracticeStreak,
          isCompleted: false,
        }),
        buildQuest({
          id: 33,
          moduleId: null,
          type: QuestTypeValues.masterDailyQuests,
          isCompleted: false,
        }),
      ] as never)
      .mockResolvedValueOnce([
        buildQuest({
          id: 31,
          moduleId: 7,
          type: QuestTypeValues.completeDailyPractice,
          isCompleted: true,
        }),
        buildQuest({
          id: 32,
          moduleId: 7,
          type: QuestTypeValues.dailyPracticeStreak,
          isCompleted: false,
        }),
        buildQuest({
          id: 33,
          moduleId: null,
          type: QuestTypeValues.masterDailyQuests,
          isCompleted: false,
        }),
      ] as never);
    prisma.dailyPracticeSet.findUnique.mockResolvedValue({
      completedAt: progressedAt,
      items: [{ questionUnitId: 101 }, { questionUnitId: 102 }],
    } as never);
    prisma.questionAttempt.findMany.mockResolvedValue([
      {
        questionId: 101,
        isCorrect: true,
        hintsUsed: 1,
      },
      {
        questionId: 102,
        isCorrect: true,
        hintsUsed: 0,
      },
    ] as never);

    await service.recordDailyPracticeSetProgress(
      {
        userId: 42,
        moduleId: 7,
        progressedAt,
      },
      prisma,
    );

    expect(prisma.dailyPracticeSet.findUnique).toHaveBeenCalledWith({
      where: {
        userId_moduleId_practiceDateUtc: {
          userId: 42,
          moduleId: 7,
          practiceDateUtc: new Date('2026-03-20T00:00:00.000Z'),
        },
      },
      select: {
        completedAt: true,
        items: {
          select: {
            questionUnitId: true,
          },
        },
      },
    });
    expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 42,
        questionId: {
          in: [101, 102],
        },
        attemptedAt: {
          gte: new Date('2026-03-20T00:00:00.000Z'),
          lt: new Date('2026-03-21T00:00:00.000Z'),
        },
        session: {
          moduleId: 7,
          userId: 42,
          sessionType: PracticeSessionTypeValues.dailyPractice,
        },
      },
      orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
      select: {
        questionId: true,
        isCorrect: true,
        hintsUsed: true,
      },
    });
    expect(prisma.dailyQuest.update).toHaveBeenCalledTimes(1);
    expect(prisma.dailyQuest.update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: expect.objectContaining({
        isCompleted: true,
        completedAt: progressedAt,
      }),
    });
    expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(1);
    expect(avatarService.addStudentExp).toHaveBeenCalledWith(42, 50, prisma);
  });

  it('completes the daily-practice streak quest from first attempts across the persisted set timeline', async () => {
    const progressedAt = new Date('2026-03-20T09:30:00.000Z');
    prisma.dailyQuest.findMany
      .mockResolvedValueOnce([
        buildQuest({
          id: 41,
          moduleId: 7,
          type: QuestTypeValues.completeDailyPractice,
          isCompleted: true,
        }),
        buildQuest({
          id: 42,
          moduleId: 7,
          type: QuestTypeValues.dailyPracticeStreak,
          isCompleted: false,
        }),
        buildQuest({
          id: 43,
          moduleId: 7,
          type: QuestTypeValues.completeNewUnit,
          isCompleted: true,
        }),
        buildQuest({
          id: 44,
          moduleId: null,
          type: QuestTypeValues.masterDailyQuests,
          isCompleted: false,
        }),
      ] as never)
      .mockResolvedValueOnce([
        buildQuest({
          id: 41,
          moduleId: 7,
          type: QuestTypeValues.completeDailyPractice,
          isCompleted: true,
        }),
        buildQuest({
          id: 42,
          moduleId: 7,
          type: QuestTypeValues.dailyPracticeStreak,
          isCompleted: true,
        }),
        buildQuest({
          id: 43,
          moduleId: 7,
          type: QuestTypeValues.completeNewUnit,
          isCompleted: true,
        }),
        buildQuest({
          id: 44,
          moduleId: null,
          type: QuestTypeValues.masterDailyQuests,
          isCompleted: false,
        }),
      ] as never)
      .mockResolvedValueOnce([
        buildQuest({
          id: 41,
          moduleId: 7,
          type: QuestTypeValues.completeDailyPractice,
          isCompleted: true,
        }),
        buildQuest({
          id: 42,
          moduleId: 7,
          type: QuestTypeValues.dailyPracticeStreak,
          isCompleted: true,
        }),
        buildQuest({
          id: 43,
          moduleId: 7,
          type: QuestTypeValues.completeNewUnit,
          isCompleted: true,
        }),
        buildQuest({
          id: 44,
          moduleId: null,
          type: QuestTypeValues.masterDailyQuests,
          isCompleted: false,
        }),
      ] as never);
    prisma.dailyPracticeSet.findUnique.mockResolvedValue({
      completedAt: null,
      items: [
        { questionUnitId: 101 },
        { questionUnitId: 102 },
        { questionUnitId: 103 },
        { questionUnitId: 104 },
      ],
    } as never);
    prisma.questionAttempt.findMany.mockResolvedValue([
      {
        questionId: 101,
        isCorrect: false,
        hintsUsed: 0,
      },
      {
        questionId: 101,
        isCorrect: true,
        hintsUsed: 0,
      },
      {
        questionId: 102,
        isCorrect: true,
        hintsUsed: 0,
      },
      {
        questionId: 103,
        isCorrect: true,
        hintsUsed: 1,
      },
      {
        questionId: 104,
        isCorrect: true,
        hintsUsed: 0,
      },
      {
        questionId: 105,
        isCorrect: true,
        hintsUsed: 0,
      },
      {
        questionId: 106,
        isCorrect: true,
        hintsUsed: 0,
      },
    ] as never);

    await service.recordDailyPracticeSetProgress(
      {
        userId: 42,
        moduleId: 7,
        progressedAt,
      },
      prisma,
    );

    expect(prisma.dailyQuest.update).toHaveBeenCalledTimes(2);
    expect(prisma.dailyQuest.update).toHaveBeenNthCalledWith(1, {
      where: { id: 42 },
      data: expect.objectContaining({
        isCompleted: true,
        completedAt: progressedAt,
      }),
    });
    expect(prisma.dailyQuest.update).toHaveBeenNthCalledWith(2, {
      where: { id: 44 },
      data: expect.objectContaining({
        isCompleted: true,
        completedAt: progressedAt,
        expGranted: 250,
      }),
    });
    expect(expLedgerService.recordEvent).toHaveBeenCalledTimes(2);
    expect(avatarService.addStudentExp).toHaveBeenNthCalledWith(
      1,
      42,
      50,
      prisma,
    );
    expect(avatarService.addStudentExp).toHaveBeenNthCalledWith(
      2,
      42,
      250,
      prisma,
    );
    expect(
      questStreakService.getRewardForNextMasterQuestCompletion,
    ).toHaveBeenCalledWith(42, progressedAt, prisma);
  });
});

function buildQuest(params: {
  id: number;
  moduleId: number | null;
  type: QuestType;
  isCompleted: boolean;
}) {
  return {
    id: params.id,
    userId: 42,
    moduleId: params.moduleId,
    moduleUnitId: null,
    type: params.type,
    expGranted: params.type === QuestTypeValues.masterDailyQuests ? 250 : 50,
    isCompleted: params.isCompleted,
    questDateUtc: new Date('2026-03-20T00:00:00.000Z'),
  };
}
