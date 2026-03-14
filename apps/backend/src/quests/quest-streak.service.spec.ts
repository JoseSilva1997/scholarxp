// Role: verifies master-quest streak derivation stays anchored to completed quest days and capped reward rules.
import { Test, type TestingModule } from '@nestjs/testing';
import {
  MASTER_QUEST_COMPLETION_REWARD,
  MASTER_QUEST_STREAK_MAX,
} from '@scholarxp/constants';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { QuestStreakService } from './quest-streak.service';

describe('QuestStreakService', () => {
  let service: QuestStreakService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuestStreakService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(QuestStreakService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns a zero streak when the student has never completed a master quest', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([]);

    await expect(
      service.getCurrentStreakStatus(42, new Date('2026-03-14T09:00:00.000Z')),
    ).resolves.toEqual({
      currentStreak: 0,
      maxStreak: 5,
      bonusPercent: 0,
      bonusPercentPerStep: 10,
      lastCompletedQuestDateUtc: null,
    });
  });

  it('derives the live streak from yesterday when today is not yet completed', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([
      { questDateUtc: new Date('2026-03-13T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-12T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-11T00:00:00.000Z') },
    ] as never);

    await expect(
      service.getCurrentStreakStatus(42, new Date('2026-03-14T09:00:00.000Z')),
    ).resolves.toEqual({
      currentStreak: 3,
      maxStreak: 5,
      bonusPercent: 30,
      bonusPercentPerStep: 10,
      lastCompletedQuestDateUtc: '2026-03-13',
    });
  });

  it('resets the effective streak to zero after a missed UTC day', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([
      { questDateUtc: new Date('2026-03-12T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-11T00:00:00.000Z') },
    ] as never);

    await expect(
      service.getCurrentStreakStatus(42, new Date('2026-03-14T09:00:00.000Z')),
    ).resolves.toEqual({
      currentStreak: 0,
      maxStreak: 5,
      bonusPercent: 0,
      bonusPercentPerStep: 10,
      lastCompletedQuestDateUtc: '2026-03-12',
    });
  });

  it('includes today when the master quest has already been completed', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([
      { questDateUtc: new Date('2026-03-14T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-13T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-12T00:00:00.000Z') },
    ] as never);

    await expect(
      service.getCurrentStreakStatus(42, new Date('2026-03-14T09:00:00.000Z')),
    ).resolves.toEqual({
      currentStreak: 3,
      maxStreak: 5,
      bonusPercent: 30,
      bonusPercentPerStep: 10,
      lastCompletedQuestDateUtc: '2026-03-14',
    });
  });

  it('computes the next master-quest reward from the derived streak and caps it at five days', async () => {
    prisma.dailyQuest.findMany.mockResolvedValue([
      { questDateUtc: new Date('2026-03-13T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-12T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-11T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-10T00:00:00.000Z') },
      { questDateUtc: new Date('2026-03-09T00:00:00.000Z') },
    ] as never);

    await expect(
      service.getRewardForNextMasterQuestCompletion(
        42,
        new Date('2026-03-14T09:00:00.000Z'),
      ),
    ).resolves.toEqual({
      streakCount: MASTER_QUEST_STREAK_MAX,
      bonusPercent: 50,
      awardedExp: Math.round(MASTER_QUEST_COMPLETION_REWARD * 1.5),
    });
  });
});
