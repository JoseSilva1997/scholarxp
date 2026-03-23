// Role: validates that daily-practice attempt submission honours first-attempt-only FSRS mutation,
// so retries within the same session record history without corrupting spaced-repetition scheduling.
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertSafeE2eDatabaseUrl,
  clearDailyPracticeE2eDatabase,
  createDailyPracticeE2eApp,
  fetchTodayDailyPractice,
  seedStudentModuleScenario,
  setAuthenticatedUserId,
  submitDailyPracticeAttemptCorrect,
  submitDailyPracticeAttemptIncorrect,
} from './helpers';
import { seedStudentReviewReadyScenario } from './scenarios';

describe('Daily practice attempt behaviour (e2e)', () => {
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

  it('re-answering a question in the same session records the attempt but does not update FSRS state', async () => {
    // Setup: 1 completed lesson (yesterday), 7 due-review questions → MIN size 3.
    // We submit an incorrect first attempt (triggers FSRS 'again' grade), snapshot
    // the StudentQuestionState, then submit a correct retry and verify FSRS fields
    // are unchanged while a second QuestionAttempt row exists.
    const base = await seedStudentModuleScenario(prisma);
    setAuthenticatedUserId(base.studentId);
    await seedStudentReviewReadyScenario(prisma, base);

    // Fetch daily practice to create the set and session.
    const body = await fetchTodayDailyPractice(app, base.moduleId);
    const targetQuestion = body.questions[0];

    const attemptParams = {
      setId: body.setId,
      sessionId: body.sessionId,
      moduleUnitId: targetQuestion.moduleUnitId,
      questionUnitId: targetQuestion.questionUnitId,
      questionContentId: targetQuestion.coreQuestion.questionContent.id,
    };

    // ── First attempt: incorrect ──
    // This is the first daily-practice attempt for this question, so FSRS must
    // apply the 'again' grade (incorrect first attempt → again).
    const firstResponse = await submitDailyPracticeAttemptIncorrect(
      app,
      base.moduleId,
      attemptParams,
    );
    expect(firstResponse.encounterGrade).toBe('again');
    expect(firstResponse.hasCorrectAttempt).toBe(false);

    // Snapshot FSRS state immediately after the first attempt — this is the
    // authoritative scheduling state that must survive the retry.
    const stateAfterFirstAttempt =
      await prisma.studentQuestionState.findFirstOrThrow({
        where: {
          userId: base.studentId,
          questionUnitId: targetQuestion.questionUnitId,
        },
      });

    // ── Retry: correct answer for the same question ──
    // Product rule: "Retries update attempt history and UI state but do not
    // mutate FSRS state again." If this guard breaks, the 'good' grade would
    // overwrite the 'again' grade, pushing the next review date far into the
    // future and corrupting the student's spaced-repetition schedule.
    await submitDailyPracticeAttemptCorrect(app, base.moduleId, attemptParams);

    // ── Assert: two QuestionAttempt rows exist ──
    // Both the incorrect first attempt and the correct retry must be persisted
    // for history and analytics.
    const attempts = await prisma.questionAttempt.findMany({
      where: {
        studentId: base.studentId,
        questionId: targetQuestion.questionUnitId,
      },
      orderBy: { attemptedAt: 'asc' },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0].isCorrect).toBe(false);
    expect(attempts[1].isCorrect).toBe(true);

    // ── Assert: FSRS state is identical to the post-first-attempt snapshot ──
    // These are the scheduling-critical fields. If any of them changed, the
    // retry mutated FSRS state — which is the exact regression this test guards.
    const stateAfterRetry = await prisma.studentQuestionState.findFirstOrThrow({
      where: {
        userId: base.studentId,
        questionUnitId: targetQuestion.questionUnitId,
      },
    });

    expect(stateAfterRetry.fsrsDueAt.toISOString()).toBe(
      stateAfterFirstAttempt.fsrsDueAt.toISOString(),
    );
    expect(stateAfterRetry.fsrsStability).toBe(
      stateAfterFirstAttempt.fsrsStability,
    );
    expect(stateAfterRetry.fsrsDifficulty).toBe(
      stateAfterFirstAttempt.fsrsDifficulty,
    );
    expect(stateAfterRetry.fsrsState).toBe(stateAfterFirstAttempt.fsrsState);
    expect(stateAfterRetry.reviewCount).toBe(
      stateAfterFirstAttempt.reviewCount,
    );
    expect(stateAfterRetry.lapseCount).toBe(stateAfterFirstAttempt.lapseCount);
    expect(stateAfterRetry.lastGrade).toBe(stateAfterFirstAttempt.lastGrade);

    // ── Assert: progress counts the question once, not twice ──
    // The retry should not double-count the question as answered.
    const resumedBody = await fetchTodayDailyPractice(app, base.moduleId);
    expect(resumedBody.progress.answeredQuestions).toBe(1);

    // The question should surface as having a correct attempt after the retry.
    const resumedQuestion = resumedBody.questions.find(
      (q) => q.questionUnitId === targetQuestion.questionUnitId,
    );
    expect(resumedQuestion?.hasCorrectAttempt).toBe(true);
  });
});
