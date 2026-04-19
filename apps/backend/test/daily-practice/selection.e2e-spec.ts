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
  generateTodayDailyPracticeSets,
  seedStudentModuleScenario,
  setAuthenticatedUserId,
} from './helpers';
import {
  seedCompletedLessonProgress,
  seedDueReviewStateForQuestions,
  seedLiveModuleUnitWithMcqQuestions,
  seedStudentDueShortfallScenario,
  seedStudentMixedHistoryScenario,
  seedStudentMultipleCompletedLessonsScenario,
  seedStudentQuestionState,
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

  it('shows an unseen active variant in daily practice while keeping the set question-scoped', async () => {
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentReviewReadyScenario(prisma, base);
    const targetQuestion = scenario.firstLesson.questions[0];

    const variantContent = await prisma.questionContent.create({
      data: {
        type: 'mcq',
        questionUnitId: targetQuestion.questionUnitId,
        isCore: false,
        questionStem: 'Variant phrasing for question 1',
        questionData: {
          options: [{ optionText: 'Correct' }, { optionText: 'Wrong' }],
          correctOptionIndex: 0,
        },
        hint: 'Variant hint',
        difficultyScore: 1,
        source: 'seeded-daily-practice-e2e',
        isArchived: false,
      },
    });
    await prisma.questionVariant.create({
      data: {
        questionUnitId: targetQuestion.questionUnitId,
        contentId: variantContent.id,
        variantLabel: 'Variant A',
      },
    });

    const body = await fetchTodayDailyPractice(app, base.moduleId);
    const selectedQuestion = body.questions.find(
      (question) => question.questionUnitId === targetQuestion.questionUnitId,
    );

    expect(selectedQuestion).toBeDefined();
    expect(selectedQuestion?.coreQuestion.questionId).toBe(
      targetQuestion.questionUnitId,
    );
    expect(selectedQuestion?.coreQuestion.questionContent.id).toBe(
      variantContent.id,
    );
    expect(selectedQuestion?.coreQuestion.questionContent.questionStem).toBe(
      'Variant phrasing for question 1',
    );

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
    const persistedItem = persistedSet?.items.find(
      (item) => item.questionUnitId === targetQuestion.questionUnitId,
    );

    expect(persistedItem?.questionContentId).toBe(variantContent.id);
  });

  it('labels questions with the reinforcement bucket when they are not yet due but were recently struggled with', async () => {
    // seedStudentMixedHistoryScenario produces:
    //   - dueLesson: 4 due-review questions (all overdue)
    //   - mixedLesson: 1 reinforcement candidate (hard grade, lapse, future due) + 2 unseen
    // Review pressure = 4 due + 1 reinforcement = 5. Target size = 3 (floor).
    // Quota at 3: 2 due_review + 1 reinforcement. Unseen questions are never eligible.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentMixedHistoryScenario(prisma, base);

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(3);
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(2);
    const reinforcementQuestions = body.questions.filter(
      (question) =>
        question.sourceBucket ===
        DailyPracticeSelectionBucketValues.reinforcement,
    );
    expect(reinforcementQuestions).toHaveLength(1);
    // The reinforcement question must come from the mixed lesson, not the completed due lesson.
    expect(reinforcementQuestions[0].moduleUnitId).toBe(
      scenario.mixedLesson.moduleUnitId,
    );
  });

  it('backfills a due-review shortfall with extra reinforcement candidates', async () => {
    // seedStudentDueShortfallScenario produces:
    //   - completedLesson: 1 due-review question
    //   - startedLesson:   2 reinforcement candidates ('again' grade, not yet due)
    // reviewEligible = 1 + 2 = 3 → Math.round(0.75) = 1 → clamped to MIN = 3.
    // Nominal quota at size 3: 2 due_review, 1 reinforcement.
    // Due shortfall = 1 → selector backfills with the second reinforcement candidate.
    // Expected result: 1 dueReview + 2 reinforcement (bucket label preserved, not the quota slot).
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentDueShortfallScenario(prisma, base);

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(3);

    expect(
      body.questions.filter(
        (q) => q.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(1);

    const reinforcementQuestions = body.questions.filter(
      (q) =>
        q.sourceBucket === DailyPracticeSelectionBucketValues.reinforcement,
    );
    expect(reinforcementQuestions).toHaveLength(2);
    expect(
      reinforcementQuestions.every(
        (q) => q.moduleUnitId === scenario.startedLesson.moduleUnitId,
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
      include: { items: true },
    });
    expect(persistedSet?.items).toHaveLength(3);
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(2);
  });

  it('returns a zero-plan when the student is unlocked but all reviewed questions are fully up-to-date and not yet due', async () => {
    // Scenario: student completed a lesson yesterday (unlocked today) but every question was
    // answered correctly and is not due again for several days. There are no reinforcement
    // candidates (no 'again'/'hard' grades, no lapses). The selector finds zero eligible
    // questions and must return a zero-plan (404), not an error.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);

    const completedLesson = await seedLiveModuleUnitWithMcqQuestions(
      prisma,
      base.moduleId,
      {
        title: 'Completed lesson',
        sortOrder: 1,
        questionCount: 7,
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
      questionIds: completedLesson.questions.map((q) => q.questionUnitId),
      dueAt: new Date(dayStartUtc.getTime() + 3 * 24 * 60 * 60 * 1000),
      lastSeenAt: completedAt,
    });

    await generateTodayDailyPracticeSets(app);

    await request(app.getHttpServer())
      .get(`/module/${base.moduleId}/daily-practice/today`)
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe(
          'No daily practice questions are available for this module yet.',
        );
      });

    const persistedSet = await prisma.dailyPracticeSet.findFirst({
      where: {
        userId: base.studentId,
        moduleId: base.moduleId,
      },
      include: {
        items: true,
      },
    });
    expect(persistedSet).not.toBeNull();
    expect(persistedSet?.items).toHaveLength(0);
  });

  it('draws due-review questions from all completed lessons, not just one', async () => {
    // seedStudentMultipleCompletedLessonsScenario produces:
    //   completedLesson1 (sortOrder 1): 1 due-review question
    //   completedLesson2 (sortOrder 2): 2 due-review questions
    // reviewEligible = 3 → size = 3 → quota: 2 dueReview + 1 reinforcement.
    // 0 reinforcement → backfill → 3 dueReview total.
    // With exactly 3 due-review candidates across 2 lessons, all 3 must be selected,
    // making the cross-lesson distribution fully deterministic.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentMultipleCompletedLessonsScenario(
      prisma,
      base,
    );

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(3);
    expect(
      body.questions.every(
        (q) => q.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toBe(true);

    expect(
      body.questions.filter(
        (q) => q.moduleUnitId === scenario.completedLesson1.moduleUnitId,
      ),
    ).toHaveLength(1);
    expect(
      body.questions.filter(
        (q) => q.moduleUnitId === scenario.completedLesson2.moduleUnitId,
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
    expect(persistedSet?.items).toHaveLength(3);
    expect(
      persistedSet?.items.filter(
        (item) => item.moduleUnitId === scenario.completedLesson1.moduleUnitId,
      ),
    ).toHaveLength(1);
    expect(
      persistedSet?.items.filter(
        (item) => item.moduleUnitId === scenario.completedLesson2.moduleUnitId,
      ),
    ).toHaveLength(2);
  });

  it('does not create a daily set when fewer than three attempted questions exist', async () => {
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

    await generateTodayDailyPracticeSets(app);

    await request(app.getHttpServer())
      .get(`/module/${base.moduleId}/daily-practice/today`)
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe(
          'No daily practice questions are available for this module yet.',
        );
      });

    const persistedSet = await prisma.dailyPracticeSet.findFirst({
      where: {
        userId: base.studentId,
        moduleId: base.moduleId,
      },
      include: {
        items: true,
      },
    });
    expect(persistedSet).not.toBeNull();
    expect(persistedSet?.items).toHaveLength(0);
  });
});
