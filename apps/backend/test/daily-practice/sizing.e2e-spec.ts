// Role: validates the adaptive set-sizing boundaries so the full stack (selector + sizing
// policy + persistence) respects the MIN/MAX clamp and produces the correct bucket quotas
// at each size extreme. Bucket-label correctness is in selection.e2e-spec.ts; this file
// focuses purely on quantity guarantees.
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

  it('produces a three-question set with no new-sequence slot when review pressure is just below the size-4 threshold', async () => {
    // reviewEligible = 12 due_review + 1 reinforcement = 13.
    // Math.round(13 × 0.25) = Math.round(3.25) = 3 → size floor, new-sequence quota stays zero.
    // The unseen question in the started lesson must NOT appear even though it is eligible for new-sequence.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentSizingBoundaryScenario(prisma, base, {
      dueReviewCount: 12,
    });

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(3);
    // No new-sequence question must be present at this size.
    expect(
      body.questions.filter(
        (q) =>
          q.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(0);

    // Confirm the persisted snapshot also has 3 items with no new-sequence bucket.
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
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(0);
  });

  it('produces a four-question set with one new-sequence slot when review pressure crosses the size-4 threshold', async () => {
    // reviewEligible = 13 due_review + 1 reinforcement = 14.
    // Math.round(14 × 0.25) = Math.round(3.5) = 4 → new-sequence quota of 1 unlocks.
    // This is the exact integer boundary where the new-sequence slot first appears.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentSizingBoundaryScenario(prisma, base, {
      dueReviewCount: 13,
    });

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(4);
    const newSequenceQuestions = body.questions.filter(
      (q) => q.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
    );
    // Exactly one new-sequence question must appear now that the threshold is crossed.
    expect(newSequenceQuestions).toHaveLength(1);
    // It must come from the started incomplete lesson (the only source of unseen questions).
    expect(newSequenceQuestions[0].moduleUnitId).toBe(
      scenario.startedLesson.moduleUnitId,
    );

    // Confirm the persisted set reflects the same 4-question distribution.
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
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(1);
  });

  it('builds a six-question set when review pressure reaches the maximum ceiling', async () => {
    // seedStudentMaxPressureScenario seeds 21 due-review + 1 reinforcement candidate,
    // giving reviewEligible=22. Math.round(22 * 0.25) = 6 = MAX_DAILY_PRACTICE_QUESTION_COUNT.
    // Expected quota at size 6: 4 due_review + 1 reinforcement + 1 new_sequence.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentMaxPressureScenario(prisma, base);

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    // Total question count is clamped at the configured ceiling.
    expect(body.questions).toHaveLength(6);

    // Bucket quotas at size 6: 4 due_review, 1 reinforcement, 1 new_sequence.
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
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(1);
    const newSequenceQuestions = body.questions.filter(
      (question) =>
        question.sourceBucket ===
        DailyPracticeSelectionBucketValues.newSequence,
    );
    expect(newSequenceQuestions).toHaveLength(1);

    // The new-sequence question must come from the in-progress lesson, not the completed one.
    expect(newSequenceQuestions[0].moduleUnitId).toBe(
      scenario.progressLesson.moduleUnitId,
    );

    // Confirm the set is persisted with the same distribution.
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
    expect(persistedSet?.items).toHaveLength(6);
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(4);
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(1);
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(1);
  });
});
