// Role: validates daily-practice selection buckets and ordering so adaptive sets remain stable and product rules stay executable.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  DailyPracticeSelectionBucketValues,
  PracticeSessionTypeValues,
} from '@scholarxp/api-contracts';
import { DateHelpers } from '../../src/helpers/helpers';
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
  seedCompletedLessonProgress,
  seedDueReviewStateForQuestions,
  seedLiveModuleUnitWithMcqQuestions,
  seedStudentDueShortfallScenario,
  seedStudentMixedHistoryScenario,
  seedStudentQuestionState,
  seedStudentStartedLessonFallbackScenario,
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
    expect(body.progress.totalQuestions).toBe(3);
    expect(body.questions).toHaveLength(3);
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
    expect(persistedSet?.items).toHaveLength(3);
    expect(
      persistedSet?.items.every(
        (item) =>
          item.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toBe(true);
  });

  it('backfills from a started lesson and excludes untouched lessons from new-sequence', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentStartedLessonFallbackScenario(
      prisma,
      base,
    );

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(3);
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(1);
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(2);
    expect(
      body.questions
        .filter(
          (question) =>
            question.sourceBucket ===
            DailyPracticeSelectionBucketValues.newSequence,
        )
        .every(
          (question) =>
            question.moduleUnitId === scenario.startedLesson.moduleUnitId,
        ),
    ).toBe(true);
    expect(
      body.questions.every(
        (question) =>
          question.moduleUnitId !== scenario.untouchedLesson.moduleUnitId,
      ),
    ).toBe(true);
  });

  it('labels questions with the reinforcement bucket when they are not yet due but were recently struggled with', async () => {
    // seedStudentMixedHistoryScenario produces:
    //   - dueLesson: 4 due-review questions (all overdue)
    //   - mixedLesson: 1 reinforcement candidate (hard grade, lapse, future due) + 2 unseen
    // Review pressure = 4 due + 1 reinforcement = 5. Target size = 3 (floor).
    // Quota at 3: 2 due_review, 1 reinforcement, 0 new_sequence.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentMixedHistoryScenario(prisma, base);

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(3);
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(2);
    const reinforcementQuestions = body.questions.filter(
      (question) =>
        question.sourceBucket === DailyPracticeSelectionBucketValues.reinforcement,
    );
    expect(reinforcementQuestions).toHaveLength(1);
    // The reinforcement question must come from the mixed lesson, not the completed due lesson.
    expect(reinforcementQuestions[0].moduleUnitId).toBe(
      scenario.mixedLesson.moduleUnitId,
    );
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(0);
  });

  it('backfills a due-review shortfall with extra reinforcement candidates when no new-sequence pool exists', async () => {
    // seedStudentDueShortfallScenario produces:
    //   - completedLesson: 1 due-review question
    //   - startedLesson:   2 reinforcement candidates ('again' grade, not yet due), 0 unseen questions
    // reviewEligible = 1 + 2 = 3 → Math.round(0.75) = 1 → clamped to MIN = 3.
    // Nominal quota at size 3: 2 due_review, 1 reinforcement.
    // Due shortfall = 1 → selector backfills with the second reinforcement candidate.
    // Expected result: 1 dueReview + 2 reinforcement (bucket label preserved, not the quota slot).
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentDueShortfallScenario(prisma, base);

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(3);

    // Exactly one due-review question (the only one available).
    expect(
      body.questions.filter(
        (q) => q.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(1);

    // Two reinforcement questions: one fills the reinforcement quota, the other covers the due shortfall.
    // The sourceBucket label reflects classification, not which quota slot the question filled.
    const reinforcementQuestions = body.questions.filter(
      (q) =>
        q.sourceBucket === DailyPracticeSelectionBucketValues.reinforcement,
    );
    expect(reinforcementQuestions).toHaveLength(2);
    // Both reinforcement questions must come from the started lesson.
    expect(
      reinforcementQuestions.every(
        (q) => q.moduleUnitId === scenario.startedLesson.moduleUnitId,
      ),
    ).toBe(true);

    // No new-sequence questions should appear — the backfill was satisfied by reinforcement alone.
    expect(
      body.questions.filter(
        (q) =>
          q.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(0);

    // Confirm persisted set matches the same distribution.
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
          item.sourceBucket === DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(2);
  });

  it('does not create a daily set when fewer than three eligible questions exist', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);

    const completedLesson = await seedLiveModuleUnitWithMcqQuestions(
      prisma,
      base.moduleId,
      {
        title: 'Completed lesson',
        sortOrder: 1,
        questionCount: 1,
      },
    );
    const startedLesson = await seedLiveModuleUnitWithMcqQuestions(
      prisma,
      base.moduleId,
      {
        title: 'Started lesson',
        sortOrder: 2,
        questionCount: 2,
      },
    );
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(new Date());
    const completedAt = new Date(
      dayStartUtc.getTime() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
    );

    await seedCompletedLessonProgress(prisma, {
      moduleUnitId: completedLesson.moduleUnitId,
      studentId: base.studentId,
      completedAt,
    });
    await seedDueReviewStateForQuestions(prisma, {
      studentId: base.studentId,
      moduleId: base.moduleId,
      moduleUnitId: completedLesson.moduleUnitId,
      questionIds: completedLesson.questions.map(
        (question) => question.questionUnitId,
      ),
      dueAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
      lastSeenAt: completedAt,
    });
    await seedStudentQuestionState(prisma, {
      studentId: base.studentId,
      moduleId: base.moduleId,
      moduleUnitId: startedLesson.moduleUnitId,
      questionUnitId: startedLesson.questions[0].questionUnitId,
      fsrsDueAt: new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000),
      lastSeenAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
      lastGrade: 'good',
      lapseCount: 0,
      firstSeenAt: completedAt,
      lastCorrectAt: completedAt,
      reviewCount: 1,
    });

    await request(app.getHttpServer())
      .get(`/module/${base.moduleId}/daily-practice/today`)
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe(
          'No daily practice questions are available for this module yet.',
        );
      });

    const persistedSetCount = await prisma.dailyPracticeSet.count({
      where: {
        userId: base.studentId,
        moduleId: base.moduleId,
      },
    });
    expect(persistedSetCount).toBe(0);
  });
});
