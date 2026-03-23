// Role: validates quest-history reward breakdown end-to-end so completed master quests read from the ledger and incomplete ones project streak bonuses.
import { INestApplication } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { QuestTypeValues } from '@scholarxp/api-contracts';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertSafeQuestE2eDatabaseUrl,
  clearQuestE2eDatabase,
  createQuestE2eApp,
  setAuthenticatedUserId,
} from './helpers';

describe('Quest history reward breakdown (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const appContext = await createQuestE2eApp();
    app = appContext.app;
    prisma = appContext.prisma;
  });

  beforeEach(async () => {
    assertSafeQuestE2eDatabaseUrl();
    await clearQuestE2eDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the awarded master quest breakdown from the exp ledger for completed quests', async () => {
    const today = new Date('2026-03-23T00:00:00.000Z');
    const student = await seedStudent(prisma, 'awarded');
    const module = await seedModule(prisma, student.id, 'awarded');
    setAuthenticatedUserId(student.id);

    await prisma.dailyQuest.createMany({
      data: [
        buildDailyQuest({
          userId: student.id,
          moduleId: module.id,
          type: QuestTypeValues.completeDailyPractice,
          questDateUtc: today,
          isCompleted: true,
          completedAt: new Date('2026-03-23T00:01:00.000Z'),
        }),
        buildDailyQuest({
          userId: student.id,
          moduleId: module.id,
          type: QuestTypeValues.dailyPracticeStreak,
          questDateUtc: today,
          isCompleted: true,
          completedAt: new Date('2026-03-23T00:02:00.000Z'),
        }),
        buildDailyQuest({
          userId: student.id,
          moduleId: module.id,
          type: QuestTypeValues.moduleUnitRetry,
          questDateUtc: today,
          isCompleted: true,
          completedAt: new Date('2026-03-23T15:25:13.651Z'),
        }),
      ],
    });
    const masterQuest = await prisma.dailyQuest.create({
      data: {
        userId: student.id,
        moduleId: null,
        moduleUnitId: null,
        type: QuestTypeValues.masterDailyQuests,
        expGranted: 250,
        isCompleted: true,
        questDateUtc: today,
        generatedAt: new Date('2026-03-23T00:00:37.050Z'),
        completedAt: new Date('2026-03-23T15:25:13.651Z'),
      },
    });
    await prisma.expLedger.create({
      data: {
        userId: student.id,
        moduleId: null,
        moduleUnitId: null,
        sessionId: null,
        questId: masterQuest.id,
        eventType: ExpLedgerEventTypes.COMPLETE_QUEST,
        awardedExp: 300,
        idempotencyKey: `quest_completion:quest:${masterQuest.id}`,
      },
    });

    const response = await request(app.getHttpServer())
      .get('/daily-quest/history')
      .query({ dayLimit: 1, dayOffset: 0 })
      .expect(200);

    const responseBody = response.body as {
      quests: Array<{
        type: string;
        expGranted: number;
        isCompleted: boolean;
        rewardBreakdown?: {
          baseExp: number;
          streakBonusExp: number;
          totalExp: number;
        } | null;
      }>;
      hasMore: boolean;
      nextDayOffset: number | null;
    };
    const returnedMasterQuest = responseBody.quests.find(
      (quest) => quest.type === QuestTypeValues.masterDailyQuests,
    );

    expect(returnedMasterQuest).toEqual(
      expect.objectContaining({
        expGranted: 300,
        isCompleted: true,
        rewardBreakdown: {
          baseExp: 250,
          streakBonusExp: 50,
          totalExp: 300,
        },
      }),
    );
    expect(responseBody.hasMore).toBe(false);
    expect(responseBody.nextDayOffset).toBeNull();
  });

  it('falls back to the stored base reward when a completed master quest has no ledger row', async () => {
    const today = new Date('2026-03-23T00:00:00.000Z');
    const student = await seedStudent(prisma, 'fallback');
    const module = await seedModule(prisma, student.id, 'fallback');
    setAuthenticatedUserId(student.id);

    await prisma.dailyQuest.create({
      data: buildDailyQuest({
        userId: student.id,
        moduleId: module.id,
        type: QuestTypeValues.completeDailyPractice,
        questDateUtc: today,
        isCompleted: true,
        completedAt: new Date('2026-03-23T00:01:00.000Z'),
      }),
    });
    await prisma.dailyQuest.create({
      data: {
        userId: student.id,
        moduleId: null,
        moduleUnitId: null,
        type: QuestTypeValues.masterDailyQuests,
        expGranted: 300,
        isCompleted: true,
        questDateUtc: today,
        generatedAt: new Date('2026-03-23T00:00:37.050Z'),
        completedAt: new Date('2026-03-23T15:25:13.651Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/daily-quest/history')
      .query({ dayLimit: 1, dayOffset: 0 })
      .expect(200);

    const responseBody = response.body as {
      quests: Array<{
        type: string;
        expGranted: number;
        isCompleted: boolean;
        rewardBreakdown?: {
          baseExp: number;
          streakBonusExp: number;
          totalExp: number;
        } | null;
      }>;
    };
    const returnedMasterQuest = responseBody.quests.find(
      (quest) => quest.type === QuestTypeValues.masterDailyQuests,
    );

    expect(returnedMasterQuest).toEqual(
      expect.objectContaining({
        expGranted: 300,
        isCompleted: true,
        rewardBreakdown: {
          baseExp: 300,
          streakBonusExp: 0,
          totalExp: 300,
        },
      }),
    );
  });

  it('projects the master quest streak bonus when the current quest is still incomplete', async () => {
    const today = new Date('2026-03-23T00:00:00.000Z');
    const yesterday = new Date('2026-03-22T00:00:00.000Z');
    const twoDaysAgo = new Date('2026-03-21T00:00:00.000Z');
    const student = await seedStudent(prisma, 'projected');
    const module = await seedModule(prisma, student.id, 'projected');
    setAuthenticatedUserId(student.id);

    await prisma.dailyQuest.createMany({
      data: [
        buildDailyQuest({
          userId: student.id,
          moduleId: module.id,
          type: QuestTypeValues.completeDailyPractice,
          questDateUtc: today,
          isCompleted: true,
          completedAt: new Date('2026-03-23T00:01:00.000Z'),
        }),
        buildDailyQuest({
          userId: student.id,
          moduleId: module.id,
          type: QuestTypeValues.dailyPracticeStreak,
          questDateUtc: today,
          isCompleted: false,
          completedAt: null,
        }),
        buildDailyQuest({
          userId: student.id,
          moduleId: module.id,
          type: QuestTypeValues.moduleUnitRetry,
          questDateUtc: today,
          isCompleted: false,
          completedAt: null,
        }),
      ],
    });
    await prisma.dailyQuest.create({
      data: {
        userId: student.id,
        moduleId: null,
        moduleUnitId: null,
        type: QuestTypeValues.masterDailyQuests,
        expGranted: 250,
        isCompleted: false,
        questDateUtc: today,
        generatedAt: new Date('2026-03-23T00:00:37.050Z'),
        completedAt: null,
      },
    });
    const priorMasterQuestOne = await prisma.dailyQuest.create({
      data: {
        userId: student.id,
        moduleId: null,
        moduleUnitId: null,
        type: QuestTypeValues.masterDailyQuests,
        expGranted: 250,
        isCompleted: true,
        questDateUtc: yesterday,
        generatedAt: new Date('2026-03-22T00:00:37.050Z'),
        completedAt: new Date('2026-03-22T09:00:00.000Z'),
      },
    });
    const priorMasterQuestTwo = await prisma.dailyQuest.create({
      data: {
        userId: student.id,
        moduleId: null,
        moduleUnitId: null,
        type: QuestTypeValues.masterDailyQuests,
        expGranted: 250,
        isCompleted: true,
        questDateUtc: twoDaysAgo,
        generatedAt: new Date('2026-03-21T00:00:37.050Z'),
        completedAt: new Date('2026-03-21T09:00:00.000Z'),
      },
    });
    await prisma.expLedger.createMany({
      data: [
        {
          userId: student.id,
          moduleId: null,
          moduleUnitId: null,
          sessionId: null,
          questId: priorMasterQuestOne.id,
          eventType: ExpLedgerEventTypes.COMPLETE_QUEST,
          awardedExp: 275,
          idempotencyKey: `quest_completion:quest:${priorMasterQuestOne.id}`,
        },
        {
          userId: student.id,
          moduleId: null,
          moduleUnitId: null,
          sessionId: null,
          questId: priorMasterQuestTwo.id,
          eventType: ExpLedgerEventTypes.COMPLETE_QUEST,
          awardedExp: 250,
          idempotencyKey: `quest_completion:quest:${priorMasterQuestTwo.id}`,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/daily-quest/history')
      .query({ dayLimit: 1, dayOffset: 0 })
      .expect(200);

    const responseBody = response.body as {
      quests: Array<{
        type: string;
        expGranted: number;
        isCompleted: boolean;
        rewardBreakdown?: {
          baseExp: number;
          streakBonusExp: number;
          totalExp: number;
        } | null;
      }>;
    };
    const returnedMasterQuest = responseBody.quests.find(
      (quest) => quest.type === QuestTypeValues.masterDailyQuests,
    );

    expect(returnedMasterQuest).toEqual(
      expect.objectContaining({
        expGranted: 300,
        isCompleted: false,
        rewardBreakdown: {
          baseExp: 250,
          streakBonusExp: 50,
          totalExp: 300,
        },
      }),
    );
  });
});

async function seedStudent(prisma: PrismaService, suffix: string) {
  return prisma.user.create({
    data: {
      firstName: 'Quest',
      lastName: 'Student',
      email: `quest-history-${suffix}-${Date.now()}@example.com`,
      globalRole: GlobalRole.student,
      isVerified: true,
    },
  });
}

async function seedModule(
  prisma: PrismaService,
  createdByUserId: number,
  suffix: string,
) {
  return prisma.module.create({
    data: {
      title: `Quest history module ${suffix}`,
      description: 'Module used to seed quest-history e2e scenarios.',
      createdByUserId,
    },
  });
}

function buildDailyQuest(input: {
  userId: number;
  moduleId: number;
  type:
    | typeof QuestTypeValues.completeDailyPractice
    | typeof QuestTypeValues.dailyPracticeStreak
    | typeof QuestTypeValues.moduleUnitRetry;
  questDateUtc: Date;
  isCompleted: boolean;
  completedAt: Date | null;
}) {
  return {
    userId: input.userId,
    moduleId: input.moduleId,
    moduleUnitId: null,
    type: input.type,
    expGranted: 50,
    isCompleted: input.isCompleted,
    questDateUtc: input.questDateUtc,
    generatedAt: new Date(input.questDateUtc.getTime() + 37_050),
    completedAt: input.completedAt,
  };
}
