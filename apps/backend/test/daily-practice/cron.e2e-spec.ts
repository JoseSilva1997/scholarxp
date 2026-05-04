// Role: validates the real Nest scheduler wiring so daily-practice generation can be triggered end-to-end without waiting for midnight.
import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  DAILY_PRACTICE_GENERATION_CRON_NAME,
  DailyPracticeGenerationScheduleService,
} from '../../src/daily-practice/daily-practice-generation-schedule.service';
import {
  assertSafeE2eDatabaseUrl,
  clearDailyPracticeE2eDatabase,
  createDailyPracticeE2eApp,
  fireDailyPracticeGenerationCronJob,
  seedStudentModuleScenario,
  setAuthenticatedUserId,
} from './helpers';
import {
  seedStudentNewScenario,
  seedStudentReviewReadyScenario,
} from './scenarios';

describe('Daily practice cron generation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const harness = await createDailyPracticeE2eApp();
    app = harness.app;
    prisma = harness.prisma;
  });

  beforeEach(async () => {
    assertSafeE2eDatabaseUrl();
    await clearDailyPracticeE2eDatabase(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers the cron job and generates today set when the scheduled tick fires', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentReviewReadyScenario(prisma, base);

    const schedulerRegistry = app.get(SchedulerRegistry);
    expect(() =>
      schedulerRegistry.getCronJob(DAILY_PRACTICE_GENERATION_CRON_NAME),
    ).not.toThrow();
    expect(
      await prisma.dailyPracticeSet.count({
        where: {
          userId: base.studentId,
          moduleId: base.moduleId,
        },
      }),
    ).toBe(0);

    const scheduleService = app.get(DailyPracticeGenerationScheduleService);
    jest
      .spyOn(
        scheduleService as DailyPracticeGenerationScheduleService & {
          getCurrentTimestamp(): Date;
        },
        'getCurrentTimestamp',
      )
      .mockReturnValue(getCurrentUtcMidnightWindowTimestamp());

    await fireDailyPracticeGenerationCronJob(app);

    await waitForDailyPracticeSetCount(prisma, {
      userId: base.studentId,
      moduleId: base.moduleId,
      expectedCount: 1,
    });

    const persistedSet = await prisma.dailyPracticeSet.findFirstOrThrow({
      where: {
        userId: base.studentId,
        moduleId: base.moduleId,
      },
      include: {
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
    expect(persistedSet.items).toHaveLength(3);

    await request(app.getHttpServer())
      .get(`/module/${base.moduleId}/daily-practice/today`)
      .expect(200)
      .expect((response) => {
        expect(response.body.setId).toBe(persistedSet.id);
        expect(response.body.questions).toHaveLength(3);
      });
  });

  it('does not generate a set for students who have not unlocked daily practice yet', async () => {
    const base = await seedStudentModuleScenario(prisma);
    await seedStudentNewScenario(prisma, base);

    await fireDailyPracticeGenerationCronJob(app);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(
      await prisma.dailyPracticeSet.count({
        where: {
          userId: base.studentId,
          moduleId: base.moduleId,
        },
      }),
    ).toBe(0);
  });
});

async function waitForDailyPracticeSetCount(
  prisma: PrismaService,
  params: {
    userId: number;
    moduleId: number;
    expectedCount: number;
  },
) {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const count = await prisma.dailyPracticeSet.count({
      where: {
        userId: params.userId,
        moduleId: params.moduleId,
      },
    });
    if (count === params.expectedCount) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    `Timed out waiting for ${params.expectedCount} daily-practice set(s) for user ${params.userId} in module ${params.moduleId}.`,
  );
}

function getCurrentUtcMidnightWindowTimestamp(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 5),
  );
}
