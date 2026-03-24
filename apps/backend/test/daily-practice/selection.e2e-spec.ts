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
  seedStudentFullySeenEarlierLessonScenario,
  seedStudentMixedHistoryScenario,
  seedStudentMultipleCompletedLessonsScenario,
  seedStudentMultipleStartedLessonsScenario,
  seedStudentQuestionState,
  seedStudentReinforcementShortfallSize4Scenario,
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
    expect(
      body.questions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.newSequence,
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
          item.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(2);
  });

  it('fills the new-sequence slot from the earliest started lesson when multiple started lessons have unseen questions', async () => {
    // seedStudentMultipleStartedLessonsScenario produces:
    //   completedLesson: 13 due-review questions
    //   lesson2 (sortOrder 2): 1 reinforcement candidate + 3 unseen new-sequence candidates
    //   lesson3 (sortOrder 3): started (1 invisible 'good' state) + 3 unseen new-sequence candidates
    // reviewEligible = 13 + 1 = 14 → Math.round(14 × 0.25) = 4 → quota: 2 dueReview, 1 reinforcement, 1 newSequence.
    // Both lesson2 and lesson3 are eligible for new-sequence, but lesson2 must win because it has a lower sortOrder.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentMultipleStartedLessonsScenario(
      prisma,
      base,
    );

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(4);
    const newSequenceQuestions = body.questions.filter(
      (q) => q.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
    );
    expect(newSequenceQuestions).toHaveLength(1);
    // The new-sequence question must come from lesson2 (earliest started lesson), not lesson3.
    expect(newSequenceQuestions[0].moduleUnitId).toBe(
      scenario.lesson2.moduleUnitId,
    );
    // No question from lesson3 may appear anywhere in the set.
    expect(
      body.questions.every(
        (q) => q.moduleUnitId !== scenario.lesson3.moduleUnitId,
      ),
    ).toBe(true);

    // Confirm the persisted set matches the same lesson-source distribution.
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
    const persistedNewSequence = persistedSet?.items.filter(
      (item) =>
        item.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
    );
    expect(persistedNewSequence).toHaveLength(1);
    expect(persistedNewSequence?.[0].moduleUnitId).toBe(
      scenario.lesson2.moduleUnitId,
    );
  });

  it('skips a started lesson with no unseen questions and fills the new-sequence slot from the next eligible lesson', async () => {
    // seedStudentFullySeenEarlierLessonScenario produces:
    //   completedLesson: 13 due-review questions
    //   lesson2 (sortOrder 2, fully-seen): 1 invisible 'good' state + 2 reinforcement candidates, 0 unseen
    //   lesson3 (sortOrder 3): 1 invisible 'good' state (makes it "started") + 2 unseen
    // reviewEligible = 13 + 2 = 15 → Math.round(15 × 0.25) = 4 → quota: 2 dueReview, 1 reinforcement, 1 newSequence.
    // lesson2 is earlier but has no unseen questions → cannot supply new-sequence.
    // lesson3 is next and DOES have unseen questions → must supply the new-sequence slot.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentFullySeenEarlierLessonScenario(
      prisma,
      base,
    );

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(4);
    const newSequenceQuestions = body.questions.filter(
      (q) => q.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
    );
    expect(newSequenceQuestions).toHaveLength(1);
    // The new-sequence question must come from lesson3, not lesson2 (lesson2 has no unseen questions).
    expect(newSequenceQuestions[0].moduleUnitId).toBe(
      scenario.lesson3.moduleUnitId,
    );

    // The reinforcement slot must still be filled from lesson2 (its 'again' candidates are valid).
    const reinforcementQuestions = body.questions.filter(
      (q) =>
        q.sourceBucket === DailyPracticeSelectionBucketValues.reinforcement,
    );
    expect(reinforcementQuestions).toHaveLength(1);
    expect(reinforcementQuestions[0].moduleUnitId).toBe(
      scenario.lesson2.moduleUnitId,
    );

    // Confirm the persisted set matches the same bucket distribution.
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

  it('returns a zero-plan when the student is unlocked but all reviewed questions are fully up-to-date and not yet due', async () => {
    // Scenario: student completed a lesson yesterday (unlocked today) but every question was
    // answered correctly and is not due again for several days. There are no reinforcement
    // candidates (no 'again'/'hard' grades, no lapses) and no started lessons for new-sequence.
    // The selector finds zero eligible questions and must return a zero-plan (404), not an error.
    // This validates that 'good'-graded non-due questions are excluded from BOTH the due_review
    // and reinforcement buckets, and that "no eligible content today" is a valid product state.
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
    // Completed yesterday — satisfies the next-day unlock rule.
    const completedAt = new Date(
      dayStartUtc.getTime() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
    );

    await seedCompletedLessonProgress(prisma, {
      moduleUnitId: completedLesson.moduleUnitId,
      studentId: base.studentId,
      completedAt,
    });
    // All questions answered correctly, scheduled 3 days from now.
    // seedDueReviewStateForQuestions uses 'good' grade and lapseCount 0, so none qualify as
    // reinforcement candidates; passing a future dueAt means none qualify as due_review either.
    await seedDueReviewStateForQuestions(prisma, {
      studentId: base.studentId,
      moduleId: base.moduleId,
      moduleUnitId: completedLesson.moduleUnitId,
      questionIds: completedLesson.questions.map((q) => q.questionUnitId),
      dueAt: new Date(dayStartUtc.getTime() + 3 * 24 * 60 * 60 * 1000),
      lastSeenAt: completedAt,
    });
    // No started lessons → new-sequence pool is empty.

    await generateTodayDailyPracticeSets(app);

    await request(app.getHttpServer())
      .get(`/module/${base.moduleId}/daily-practice/today`)
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe(
          'No daily practice questions are available for this module yet.',
        );
      });

    // A zero-plan persists an empty sentinel row so the same UTC day stays locked to "no set".
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

  it('backfills the reinforcement shortfall from due-review while preserving the new-sequence slot at size 4', async () => {
    // seedStudentReinforcementShortfallSize4Scenario produces:
    //   completedLesson: 14 due-review questions
    //   startedLesson:   1 invisible 'good' state (makes it "started") + 3 unseen
    // reviewEligible = 14 + 0 (no reinforcement candidates) = 14 → size 4.
    // Quota: 2 dueReview + 1 reinforcement + 1 newSequence.
    // 0 reinforcement candidates → remainingCount = 1 → backfill draws 1 extra from dueReview.
    // Expected result: 3 dueReview + 0 reinforcement + 1 newSequence (slot preserved, not consumed).
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    const scenario = await seedStudentReinforcementShortfallSize4Scenario(
      prisma,
      base,
    );

    const body = await fetchTodayDailyPractice(app, base.moduleId);

    expect(body.questions).toHaveLength(4);

    // The reinforcement shortfall must be filled by extra due-review, not by shrinking the set.
    expect(
      body.questions.filter(
        (q) => q.sourceBucket === DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(3);
    expect(
      body.questions.filter(
        (q) =>
          q.sourceBucket === DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(0);

    // The new-sequence slot must survive the backfill — it must not be consumed to cover the shortfall.
    const newSequenceQuestions = body.questions.filter(
      (q) => q.sourceBucket === DailyPracticeSelectionBucketValues.newSequence,
    );
    expect(newSequenceQuestions).toHaveLength(1);
    expect(newSequenceQuestions[0].moduleUnitId).toBe(
      scenario.startedLesson.moduleUnitId,
    );

    // Confirm the persisted set matches.
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
    expect(
      persistedSet?.items.filter(
        (item) =>
          item.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(0);
  });

  it('draws due-review questions from all completed lessons, not just one', async () => {
    // seedStudentMultipleCompletedLessonsScenario produces:
    //   completedLesson1 (sortOrder 1): 1 due-review question
    //   completedLesson2 (sortOrder 2): 2 due-review questions
    //   No started lessons → 0 reinforcement, 0 new-sequence candidates.
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

    // Exactly 1 question must come from lesson 1 and exactly 2 from lesson 2.
    // If the query were accidentally scoped to a single lesson this assertion would fail.
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

    // Confirm the persisted set has the same cross-lesson distribution.
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

    await generateTodayDailyPracticeSets(app);

    await request(app.getHttpServer())
      .get(`/module/${base.moduleId}/daily-practice/today`)
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe(
          'No daily practice questions are available for this module yet.',
        );
      });

    // "Too few eligible questions" is also persisted as an empty sentinel for the rest of the UTC day.
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
