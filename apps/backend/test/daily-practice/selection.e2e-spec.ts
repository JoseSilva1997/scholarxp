// Role: validates daily-practice selection buckets and ordering so adaptive sets remain stable and product rules stay executable.
import { INestApplication } from '@nestjs/common';
import {
  DailyPracticeSelectionBucketValues,
  PracticeSessionTypeValues,
} from '@scholarxp/api-contracts';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertSafeE2eDatabaseUrl,
  clearDailyPracticeE2eDatabase,
  createDailyPracticeE2eApp,
  fetchTodayDailyPractice,
  seedStudentModuleScenario,
  setAuthenticatedUserId,
} from './helpers';
import {
  seedStudentMixedHistoryScenario,
  seedStudentReviewReadyScenario,
} from './scenarios';

describe('Daily practice selection rules (e2e)', () => {
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

  it('creates a review-only set from the completed lesson when that is the only live lesson', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentReviewReadyScenario(prisma, base);

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.sessionType).toBe(PracticeSessionTypeValues.dailyPractice);
    expect(body.progress.totalQuestions).toBe(7);
    expect(body.questions).toHaveLength(7);
    expect(
      body.questions.every(
        (question) =>
          question.moduleUnitId === scenario.firstLesson.moduleUnitId &&
          question.sourceBucket ===
            DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toBe(true);

    const persistedSet = await prisma.dailyPracticeSet.findUnique({
      where: {
        userId_moduleId_practiceDateUtc: {
          userId: base.studentId,
          moduleId: base.moduleId,
          practiceDateUtc: new Date(body.practiceDateUtc),
        },
      },
      include: {
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
    expect(persistedSet?.items).toHaveLength(7);
    expect(
      persistedSet?.items.every(
        (item) =>
          item.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toBe(true);
  });

  it('uses the default 4/2/1 bucket mix and interleaves lessons when the module has mixed candidate types', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentMixedHistoryScenario(prisma, base);

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(7);
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(4);
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(2);
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(1);

    for (let index = 1; index < body.questions.length; index += 1) {
      expect(body.questions[index]?.moduleUnitId).not.toBe(
        body.questions[index - 1]?.moduleUnitId,
      );
    }
  });
});
