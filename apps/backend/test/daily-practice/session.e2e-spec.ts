// Role: validates daily-practice set/session stability so refreshes and resumes keep the same persisted module-scoped set all day.
import { INestApplication } from '@nestjs/common';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertSafeE2eDatabaseUrl,
  clearDailyPracticeE2eDatabase,
  createDailyPracticeE2eApp,
  fetchTodayDailyPractice,
  seedStudentModuleScenario,
  setAuthenticatedUserId,
} from './helpers';
import { seedStudentReviewReadyScenario } from './scenarios';

describe('Daily practice session stability (e2e)', () => {
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

  afterAll(async () => {
    await app.close();
  });

  it('returns the same persisted set and open session when the student reloads daily practice on the same UTC day', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentReviewReadyScenario(prisma, base);

    const firstBody = await fetchTodayDailyPractice(app, base.moduleId);
    const secondBody = await fetchTodayDailyPractice(app, base.moduleId);

    expect(secondBody.setId).toBe(firstBody.setId);
    expect(secondBody.sessionId).toBe(firstBody.sessionId);
    expect(
      secondBody.questions.map((question) => question.questionUnitId),
    ).toEqual(firstBody.questions.map((question) => question.questionUnitId));

    const persistedSetCount = await prisma.dailyPracticeSet.count({
      where: {
        userId: base.studentId,
        moduleId: base.moduleId,
      },
    });
    const openSessionCount = await prisma.practiceSession.count({
      where: {
        moduleId: base.moduleId,
        userId: base.studentId,
        sessionType: PracticeSessionTypeValues.dailyPractice,
        endTime: null,
      },
    });
    expect(persistedSetCount).toBe(1);
    expect(openSessionCount).toBe(1);
  });
});
