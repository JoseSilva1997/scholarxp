// Role: validates the adaptive set-sizing boundaries so the full stack (selector + sizing
// policy + persistence) respects the MIN/MAX clamp at each size extreme. Bucket-label
// correctness is in selection.e2e-spec.ts; this file focuses purely on quantity guarantees.
import { INestApplication } from '@nestjs/common';
import { DailyPracticeSelectionBucketValues } from '@scholarxp/api-contracts';
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
  seedStudentMaxPressureScenario,
  seedStudentSizingBoundaryScenario,
} from './scenarios';

describe('Daily practice sizing boundaries (e2e)', () => {
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

  it('produces a three-question set when review pressure is just below the size-4 threshold', async () => {
    // reviewEligible = 12 due_review + 1 reinforcement = 13.
    // Math.round(13 × 0.25) = Math.round(3.25) = 3 → size floor.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentSizingBoundaryScenario(prisma, base, {
      dueReviewCount: 12,
    });

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(3);

    const persistedSet = await prisma.dailyPracticeSet.findUnique({
      where: {
        userId_moduleId_practiceDateUtc: {
          userId: base.studentId,
          moduleId: base.moduleId,
          practiceDateUtc: new Date(body.practiceDateUtc),
        },
      },
      include: { items: true },
    });
    expect(persistedSet?.items).toHaveLength(3);
  });

  it('produces a four-question set when review pressure crosses the size-4 threshold', async () => {
    // reviewEligible = 13 due_review + 1 reinforcement = 14.
    // Math.round(14 × 0.25) = Math.round(3.5) = 4.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentSizingBoundaryScenario(prisma, base, {
      dueReviewCount: 13,
    });

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(4);

    const persistedSet = await prisma.dailyPracticeSet.findUnique({
      where: {
        userId_moduleId_practiceDateUtc: {
          userId: base.studentId,
          moduleId: base.moduleId,
          practiceDateUtc: new Date(body.practiceDateUtc),
        },
      },
      include: { items: true },
    });
    expect(persistedSet?.items).toHaveLength(4);
  });

  it('builds a ten-question set when review pressure reaches the maximum ceiling', async () => {
    // seedStudentMaxPressureScenario seeds 39 due-review + 2 reinforcement candidates,
    // all from completed lessons, giving reviewEligible=41.
    // Math.round(41 * 0.25) = 10 = MAX_DAILY_PRACTICE_QUESTION_COUNT.
    // Expected quota at size 10: 8 due_review + 2 reinforcement.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentMaxPressureScenario(prisma, base);

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(10);

    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(8);
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(2);

    const persistedSet = await prisma.dailyPracticeSet.findUnique({
      where: {
        userId_moduleId_practiceDateUtc: {
          userId: base.studentId,
          moduleId: base.moduleId,
          practiceDateUtc: new Date(body.practiceDateUtc),
        },
      },
      include: { items: true },
    });
    expect(persistedSet?.items).toHaveLength(10);
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(8);
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(2);
  });
});
