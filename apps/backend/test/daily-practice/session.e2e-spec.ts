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
  submitDailyPracticeAttemptCorrect,
} from './helpers';
import {
  seedStudentReviewReadyScenario,
  seedYesterdayDailyPracticeSet,
} from './scenarios';

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

  it("generates a fresh set and session on the next UTC day, leaving yesterday's set untouched", async () => {
    // Scenario: student practiced yesterday (simulated by inserting a DailyPracticeSet directly).
    // Today's fetch must create a brand-new set rather than resuming the stale one.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentReviewReadyScenario(prisma, base);

    // Plant a pre-existing set anchored to yesterday's UTC date using the first 3 questions.
    // These questions are still due today, so today's fetch will include them in the new set.
    const { setId: yesterdaysSetId } = await seedYesterdayDailyPracticeSet(
      prisma,
      {
        studentId: base.studentId,
        moduleId: base.moduleId,
        questions: scenario.firstLesson.questions.slice(0, 3).map((q) => ({
          questionUnitId: q.questionUnitId,
          questionContentId: q.questionContentId,
          moduleUnitId: scenario.firstLesson.moduleUnitId,
        })),
      },
    );

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    // Today's set must be distinct from yesterday's — the day-boundary must produce a new row.
    expect(body.setId).not.toBe(yesterdaysSetId);

    // Both rows must be preserved: yesterday's is immutable, today's is new.
    const persistedSets = await prisma.dailyPracticeSet.findMany({
      where: { userId: base.studentId, moduleId: base.moduleId },
      orderBy: { practiceDateUtc: 'asc' },
    });
    expect(persistedSets).toHaveLength(2);
    expect(persistedSets[0].id).toBe(yesterdaysSetId);
    expect(persistedSets[1].id).toBe(body.setId);

    // Exactly one open daily-practice session must exist — for today's set only.
    const openSessionCount = await prisma.practiceSession.count({
      where: {
        moduleId: base.moduleId,
        userId: base.studentId,
        sessionType: PracticeSessionTypeValues.dailyPractice,
        endTime: null,
      },
    });
    expect(openSessionCount).toBe(1);
  });

  it('preserves per-question answered state when the student returns mid-session', async () => {
    // Scenario: student answers one question, leaves, then reloads.
    // The resumed response must reflect the answered state without creating a new set or session.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentReviewReadyScenario(prisma, base);

    // First fetch: creates the set and session.
    const firstBody = await fetchTodayDailyPractice(app, base.moduleId);
    const firstQuestion = firstBody.questions[0];

    // Submit a correct MCQ answer for the first question in the set.
    // coreQuestion.questionContent.id is the questionContentId required by the submit payload.
    await submitDailyPracticeAttemptCorrect(app, base.moduleId, {
      setId: firstBody.setId,
      sessionId: firstBody.sessionId,
      moduleUnitId: firstQuestion.moduleUnitId,
      questionUnitId: firstQuestion.questionUnitId,
      questionContentId: firstQuestion.coreQuestion.questionContent.id,
    });

    // Second fetch: simulates the student returning after leaving mid-session.
    const secondBody = await fetchTodayDailyPractice(app, base.moduleId);

    // Set and session identity must be stable — no new rows created.
    expect(secondBody.setId).toBe(firstBody.setId);
    expect(secondBody.sessionId).toBe(firstBody.sessionId);

    // Progress counter must reflect the one answered question.
    expect(secondBody.progress.answeredQuestions).toBe(1);
    expect(secondBody.progress.totalQuestions).toBe(firstBody.questions.length);

    // The answered question must surface its correct-attempt state on resume.
    const resumedFirst = secondBody.questions.find(
      (q) => q.questionUnitId === firstQuestion.questionUnitId,
    );
    expect(resumedFirst?.hasCorrectAttempt).toBe(true);
    expect(resumedFirst?.coreQuestion.lastAttempt).not.toBeNull();

    // All remaining questions must still appear as unanswered.
    const unanswered = secondBody.questions.filter(
      (q) => q.questionUnitId !== firstQuestion.questionUnitId,
    );
    expect(unanswered.every((q) => q.hasCorrectAttempt === null)).toBe(true);
    expect(unanswered.every((q) => q.coreQuestion.lastAttempt === null)).toBe(
      true,
    );
  });

  it('marks the set as completedAt and saturates progress when all questions are answered', async () => {
    // Scenario: student answers every question in the set.
    // syncProgressForSet sets DailyPracticeSet.completedAt inside the last submitAttempt transaction —
    // no closeSession call required. The re-fetch must reflect the completed state.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentReviewReadyScenario(prisma, base);

    // First fetch creates a 3-question set at MIN size (7 due-review → size 3).
    const firstBody = await fetchTodayDailyPractice(app, base.moduleId);
    expect(firstBody.questions).toHaveLength(3);

    // Answer every question in the set sequentially.
    for (const question of firstBody.questions) {
      await submitDailyPracticeAttemptCorrect(app, base.moduleId, {
        setId: firstBody.setId,
        sessionId: firstBody.sessionId,
        moduleUnitId: question.moduleUnitId,
        questionUnitId: question.questionUnitId,
        questionContentId: question.coreQuestion.questionContent.id,
      });
    }

    // Re-fetch after all answers are submitted.
    const completedBody = await fetchTodayDailyPractice(app, base.moduleId);

    // Set and session identity must remain stable — completion does not create a new set.
    expect(completedBody.setId).toBe(firstBody.setId);
    expect(completedBody.sessionId).toBe(firstBody.sessionId);

    // Progress must be fully saturated and completedAt non-null.
    expect(completedBody.progress.answeredQuestions).toBe(3);
    expect(completedBody.progress.totalQuestions).toBe(3);
    expect(completedBody.progress.completedAt).not.toBeNull();

    // Every question must carry a correct-attempt flag.
    expect(
      completedBody.questions.every((q) => q.hasCorrectAttempt === true),
    ).toBe(true);

    // Verify the DB row was updated atomically inside the last submitAttempt transaction.
    const persistedSet = await prisma.dailyPracticeSet.findUnique({
      where: {
        userId_moduleId_practiceDateUtc: {
          userId: base.studentId,
          moduleId: base.moduleId,
          practiceDateUtc: new Date(completedBody.practiceDateUtc),
        },
      },
    });
    expect(persistedSet?.completedAt).not.toBeNull();
  });

  it('creates independent sets for the same student enrolled in two different modules', async () => {
    // Scenario: one student, two modules. Each module must have its own set and session.
    // If the set lookup ever lost the moduleId filter this test would catch the cross-contamination.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentReviewReadyScenario(prisma, base);

    // Create a second module and enroll the same student so both modules are accessible.
    const moduleB = await prisma.module.create({
      data: {
        title: 'Module B (isolation test)',
        description: 'Second module for cross-module isolation testing.',
        createdByUserId: base.studentId,
      },
    });
    await prisma.userModule.create({
      data: {
        moduleId: moduleB.id,
        userId: base.studentId,
        roleInModule: 'student',
        userModuleLevel: 1,
        currentExp: 0,
      },
    });
    // Seed the same review-ready history shape for Module B using the shared scenario helper.
    await seedStudentReviewReadyScenario(prisma, {
      studentId: base.studentId,
      moduleId: moduleB.id,
    });

    const bodyA = await fetchTodayDailyPractice(app, base.moduleId);
    const bodyB = await fetchTodayDailyPractice(app, moduleB.id);

    // The two sets must be distinct — module-scoped, not shared.
    expect(bodyA.setId).not.toBe(bodyB.setId);
    expect(bodyA.moduleId).toBe(base.moduleId);
    expect(bodyB.moduleId).toBe(moduleB.id);

    // Each set must have its own session.
    expect(bodyA.sessionId).not.toBe(bodyB.sessionId);

    // No question may appear in both sets — no cross-module contamination.
    const questionIdsA = new Set(bodyA.questions.map((q) => q.questionUnitId));
    expect(
      bodyB.questions.every((q) => !questionIdsA.has(q.questionUnitId)),
    ).toBe(true);

    // DB must have exactly one set per module for this student.
    const setCountA = await prisma.dailyPracticeSet.count({
      where: { userId: base.studentId, moduleId: base.moduleId },
    });
    const setCountB = await prisma.dailyPracticeSet.count({
      where: { userId: base.studentId, moduleId: moduleB.id },
    });
    expect(setCountA).toBe(1);
    expect(setCountB).toBe(1);
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
