// Role: reusable daily-practice e2e scenario builders so unlock, selection, and resume suites share the same deterministic seeded histories.
import { ModuleUnitStatus, type PrismaClient } from '@prisma/client';
import { DateHelpers } from '../../src/helpers/helpers';
import type { SeededModuleUnit, SeededStudentModuleScenario } from './helpers';

type PrismaLike =
  | PrismaClient
  | import('../../src/prisma/prisma.service').PrismaService;

export async function seedLiveModuleUnitWithMcqQuestions(
  prisma: PrismaLike,
  moduleId: number,
  input: {
    title: string;
    sortOrder: number;
    questionCount: number;
  },
): Promise<SeededModuleUnit> {
  const moduleUnit = await prisma.moduleUnit.create({
    data: {
      moduleId,
      variantContext: 'default',
      title: input.title,
      questionCount: input.questionCount,
      status: ModuleUnitStatus.live,
      sortOrder: input.sortOrder,
    },
  });

  // Explicit typing prevents TypeScript from inferring an unusable never[] across async seeded pushes.
  const questions: SeededModuleUnit['questions'] = [];
  for (let index = 0; index < input.questionCount; index += 1) {
    const questionUnit = await prisma.questionUnit.create({
      data: {
        moduleUnitId: moduleUnit.id,
        title: `${input.title} Q${index + 1}`,
        isArchived: false,
      },
    });
    const questionContent = await prisma.questionContent.create({
      data: {
        type: 'mcq',
        questionUnitId: questionUnit.id,
        isCore: true,
        questionStem: `${input.title} question ${index + 1}`,
        questionData: {
          options: [{ optionText: 'Correct' }, { optionText: 'Wrong' }],
          correctOptionIndex: 0,
        },
        hint: `Hint ${index + 1}`,
        difficultyScore: 1,
        source: 'seeded-daily-practice-e2e',
        isArchived: false,
      },
    });

    questions.push({
      questionUnitId: questionUnit.id,
      questionContentId: questionContent.id,
    });
  }

  return {
    moduleUnitId: moduleUnit.id,
    sortOrder: input.sortOrder,
    questions,
  };
}

export async function seedCompletedLessonProgress(
  prisma: PrismaLike,
  params: {
    moduleUnitId: number;
    studentId: number;
    completedAt: Date;
  },
) {
  // Completion rows are the source of truth for the next-day unlock rule, so scenarios seed them directly instead of depending on unrelated room flows.
  await prisma.moduleUnitUserProgress.create({
    data: {
      moduleUnitId: params.moduleUnitId,
      studentId: params.studentId,
      currentMasteryScore: 1,
      noOfCorrectAnswers: 1,
      isCompleted: true,
      completedAt: params.completedAt,
      lastPracticedAt: params.completedAt,
    },
  });
}

export async function seedStudentQuestionState(
  prisma: PrismaLike,
  params: {
    studentId: number;
    moduleId: number;
    moduleUnitId: number;
    questionUnitId: number;
    fsrsDueAt: Date;
    lastSeenAt: Date;
    lastGrade: string;
    lapseCount: number;
    firstSeenAt: Date;
    lastCorrectAt: Date | null;
    reviewCount: number;
  },
) {
  await prisma.studentQuestionState.create({
    data: {
      userId: params.studentId,
      moduleId: params.moduleId,
      moduleUnitId: params.moduleUnitId,
      questionUnitId: params.questionUnitId,
      fsrsState: 'review',
      fsrsDifficulty: 5,
      fsrsStability: 2,
      fsrsDueAt: params.fsrsDueAt,
      fsrsLastReviewedAt: params.lastSeenAt,
      reviewCount: params.reviewCount,
      lapseCount: params.lapseCount,
      lastGrade: params.lastGrade,
      lastSeenAt: params.lastSeenAt,
      lastCorrectAt: params.lastCorrectAt,
      recentAvgTimeMs: 900,
      firstSeenAt: params.firstSeenAt,
      algorithmVersion: 'fsrs_v1',
    },
  });
}

export async function seedDueReviewStateForQuestions(
  prisma: PrismaLike,
  params: {
    studentId: number;
    moduleId: number;
    moduleUnitId: number;
    questionIds: number[];
    dueAt: Date;
    lastSeenAt: Date;
  },
) {
  for (const questionId of params.questionIds) {
    await seedStudentQuestionState(prisma, {
      studentId: params.studentId,
      moduleId: params.moduleId,
      moduleUnitId: params.moduleUnitId,
      questionUnitId: questionId,
      fsrsDueAt: params.dueAt,
      lastSeenAt: params.lastSeenAt,
      lastGrade: 'good',
      lapseCount: 0,
      firstSeenAt: params.lastSeenAt,
      lastCorrectAt: params.lastSeenAt,
      reviewCount: 2,
    });
  }
}

export async function seedStudentNewScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
) {
  const firstLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Lesson 1',
      sortOrder: 1,
      questionCount: 7,
    },
  );

  return {
    ...base,
    firstLesson,
  };
}

export async function seedStudentDay1CompleteScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
) {
  const firstLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Lesson 1',
      sortOrder: 1,
      questionCount: 7,
    },
  );
  const { dayStartUtc } = DateHelpers.getUtcDayBounds(new Date());
  const completedAt = new Date(dayStartUtc.getTime() + 60 * 60 * 1000);

  await seedCompletedLessonProgress(prisma, {
    moduleUnitId: firstLesson.moduleUnitId,
    studentId: base.studentId,
    completedAt,
  });
  await seedDueReviewStateForQuestions(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: firstLesson.moduleUnitId,
    questionIds: firstLesson.questions.map(
      (question) => question.questionUnitId,
    ),
    dueAt: new Date(dayStartUtc.getTime() - 60 * 60 * 1000),
    lastSeenAt: completedAt,
  });

  return {
    ...base,
    firstLesson,
    completedAt,
  };
}

export async function seedStudentReviewReadyScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
) {
  const firstLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Lesson 1',
      sortOrder: 1,
      questionCount: 7,
    },
  );
  const { dayStartUtc } = DateHelpers.getUtcDayBounds(new Date());
  const completedAt = new Date(
    dayStartUtc.getTime() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
  );

  await seedCompletedLessonProgress(prisma, {
    moduleUnitId: firstLesson.moduleUnitId,
    studentId: base.studentId,
    completedAt,
  });
  await seedDueReviewStateForQuestions(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: firstLesson.moduleUnitId,
    questionIds: firstLesson.questions.map(
      (question) => question.questionUnitId,
    ),
    dueAt: new Date(dayStartUtc.getTime() - 60 * 60 * 1000),
    lastSeenAt: completedAt,
  });

  return {
    ...base,
    firstLesson,
    completedAt,
  };
}

export async function seedStudentMixedHistoryScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
) {
  const dueLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Due lesson',
      sortOrder: 1,
      questionCount: 4,
    },
  );
  const mixedLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Mixed lesson',
      sortOrder: 2,
      questionCount: 3,
    },
  );
  const { dayStartUtc } = DateHelpers.getUtcDayBounds(new Date());
  const completedAt = new Date(
    dayStartUtc.getTime() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
  );

  await seedCompletedLessonProgress(prisma, {
    moduleUnitId: dueLesson.moduleUnitId,
    studentId: base.studentId,
    completedAt,
  });
  await seedDueReviewStateForQuestions(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: dueLesson.moduleUnitId,
    questionIds: dueLesson.questions.map((question) => question.questionUnitId),
    dueAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
    lastSeenAt: completedAt,
  });
  await seedStudentQuestionState(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: mixedLesson.moduleUnitId,
    questionUnitId: mixedLesson.questions[0].questionUnitId,
    fsrsDueAt: new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000),
    lastSeenAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
    lastGrade: 'hard',
    lapseCount: 1,
    firstSeenAt: completedAt,
    lastCorrectAt: completedAt,
    reviewCount: 2,
  });

  return {
    ...base,
    dueLesson,
    mixedLesson,
    completedAt,
  };
}

// Inserts a DailyPracticeSet row anchored to yesterday's UTC calendar date.
// Used by the day-boundary test to prove today's fetch creates a new set instead of reusing yesterday's.
// No PracticeSession is seeded for yesterday — the service only finds open sessions scoped to today's set.
// Seeds a scenario where the due-review bucket falls short of its quota and the selector must
// backfill with extra reinforcement candidates instead of new-sequence questions.
//
// Inventory: 1 due-review question (completed lesson) + 2 reinforcement candidates (started lesson,
// both seen with 'again' grade, not yet due) + 0 new-sequence candidates (no unseen questions).
// reviewEligible = 1 + 2 = 3 → Math.round(3 × 0.25) = 1 → clamped to MIN = 3.
// Nominal quota at size 3: 2 due_review, 1 reinforcement, 0 new_sequence.
// Due shortfall = 1 → backfill draws the second reinforcement candidate.
// Expected selection: 1 dueReview + 2 reinforcement + 0 newSequence.
export async function seedStudentDueShortfallScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
) {
  // Single due-review question in a completed lesson (unlocked yesterday).
  const completedLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Completed lesson',
      sortOrder: 1,
      questionCount: 1,
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
    dueAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
    lastSeenAt: completedAt,
  });

  // Started incomplete lesson: both questions are reinforcement candidates.
  // Having 2 StudentQuestionState rows makes this lesson "started", satisfying the new-sequence
  // eligibility check — but since there are no unseen questions, no new-sequence pool exists.
  const startedLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Started lesson',
      sortOrder: 2,
      questionCount: 2,
    },
  );

  for (const question of startedLesson.questions) {
    await seedStudentQuestionState(prisma, {
      studentId: base.studentId,
      moduleId: base.moduleId,
      moduleUnitId: startedLesson.moduleUnitId,
      questionUnitId: question.questionUnitId,
      // Future due → not a due-review candidate; 'again' grade + lapse → reinforcement candidate.
      fsrsDueAt: new Date(dayStartUtc.getTime() + 48 * 60 * 60 * 1000),
      lastSeenAt: new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000),
      lastGrade: 'again',
      lapseCount: 1,
      firstSeenAt: completedAt,
      lastCorrectAt: null,
      reviewCount: 2,
    });
  }

  return {
    ...base,
    completedLesson,
    startedLesson,
    completedAt,
  };
}

export async function seedYesterdayDailyPracticeSet(
  prisma: PrismaLike,
  params: {
    studentId: number;
    moduleId: number;
    // Questions to include in yesterday's set — caller supplies module-unit context for each item.
    questions: { questionUnitId: number; moduleUnitId: number }[];
  },
): Promise<{ setId: string }> {
  const { dayStartUtc } = DateHelpers.getUtcDayBounds(new Date());
  // Roll back exactly 24 h to land on yesterday's UTC midnight — the @db.Date column stores only the date portion.
  const yesterdayUtc = new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000);

  const set = await prisma.dailyPracticeSet.create({
    data: {
      userId: params.studentId,
      moduleId: params.moduleId,
      practiceDateUtc: yesterdayUtc,
      algorithmVersion: 'fsrs_v1',
      items: {
        create: params.questions.map((question, index) => ({
          questionUnitId: question.questionUnitId,
          moduleUnitId: question.moduleUnitId,
          position: index + 1,
          sourceBucket: 'due_review',
          selectionReason: 'due_review',
          selectionScore: 1.0,
        })),
      },
    },
  });

  return { setId: set.id };
}

// Parameterised scenario for the sizing 3→4 boundary tests.
// Seeds a completed lesson with exactly `dueReviewCount` due-review questions and an in-progress lesson
// with one reinforcement candidate (Q0) and one unseen question (Q1, new-sequence eligible).
//
// reviewEligible = dueReviewCount + 1 reinforcement candidate.
// At dueReviewCount=12 → reviewEligible=13 → Math.round(13×0.25)=3 (no new-sequence slot).
// At dueReviewCount=13 → reviewEligible=14 → Math.round(14×0.25)=4 (new-sequence slot appears).
export async function seedStudentSizingBoundaryScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
  { dueReviewCount }: { dueReviewCount: number },
) {
  // Completed yesterday so the next-day unlock rule is satisfied.
  const completedLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Heavy review lesson',
      sortOrder: 1,
      questionCount: dueReviewCount,
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
    dueAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
    lastSeenAt: completedAt,
  });

  // Started incomplete lesson: Q0 is the reinforcement candidate (seen recently, 'again' grade, not yet due).
  // Q1 is intentionally left without a StudentQuestionState row so it qualifies for new-sequence.
  // Because Q0 has a state row, this lesson is "started" and Q1 is eligible for new-sequence selection.
  const startedLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'In-progress lesson',
      sortOrder: 2,
      questionCount: 2,
    },
  );

  await seedStudentQuestionState(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: startedLesson.moduleUnitId,
    questionUnitId: startedLesson.questions[0].questionUnitId,
    // Due far in the future → not a due-review candidate; 'again' grade + lapse → reinforcement candidate.
    fsrsDueAt: new Date(dayStartUtc.getTime() + 48 * 60 * 60 * 1000),
    lastSeenAt: new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000),
    lastGrade: 'again',
    lapseCount: 1,
    firstSeenAt: completedAt,
    lastCorrectAt: null,
    reviewCount: 2,
  });
  // Q1 (startedLesson.questions[1]) has no state row → new-sequence candidate.

  return {
    ...base,
    completedLesson,
    startedLesson,
    completedAt,
  };
}

export async function seedStudentMaxPressureScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
) {
  // 21 due-review questions + 1 reinforcement candidate = 22 review-eligible total.
  // Math.round(22 * 0.25) = Math.round(5.5) = 6 → hits MAX_DAILY_PRACTICE_QUESTION_COUNT.
  // The sizing policy then produces quota: 4 due_review, 1 reinforcement, 1 new_sequence.
  const heavyLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Heavy review lesson',
      sortOrder: 1,
      questionCount: 21,
    },
  );
  const { dayStartUtc } = DateHelpers.getUtcDayBounds(new Date());
  // Completed yesterday to satisfy the next-day unlock rule.
  const completedAt = new Date(
    dayStartUtc.getTime() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
  );

  await seedCompletedLessonProgress(prisma, {
    moduleUnitId: heavyLesson.moduleUnitId,
    studentId: base.studentId,
    completedAt,
  });
  await seedDueReviewStateForQuestions(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: heavyLesson.moduleUnitId,
    questionIds: heavyLesson.questions.map(
      (question) => question.questionUnitId,
    ),
    dueAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
    lastSeenAt: completedAt,
  });

  // progressLesson: one reinforcement candidate (Q0, seen with 'again' grade, future due)
  // and three unseen questions (Q1–Q3) as new-sequence candidates.
  const progressLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'In-progress lesson',
      sortOrder: 2,
      questionCount: 4,
    },
  );

  // 'again' grade + lapse means this question is a reinforcement candidate (not yet due).
  await seedStudentQuestionState(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: progressLesson.moduleUnitId,
    questionUnitId: progressLesson.questions[0].questionUnitId,
    fsrsDueAt: new Date(dayStartUtc.getTime() + 48 * 60 * 60 * 1000),
    lastSeenAt: new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000),
    lastGrade: 'again',
    lapseCount: 1,
    firstSeenAt: completedAt,
    lastCorrectAt: null,
    reviewCount: 2,
  });
  // Questions 1–3 are intentionally left without state → new-sequence candidates.

  return {
    ...base,
    heavyLesson,
    progressLesson,
    completedAt,
  };
}

export async function seedStudentStartedLessonFallbackScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
) {
  const completedLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Completed review lesson',
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
      questionCount: 3,
    },
  );
  const untouchedLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'Untouched lesson',
      sortOrder: 3,
      questionCount: 3,
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

  return {
    ...base,
    completedLesson,
    startedLesson,
    untouchedLesson,
    completedAt,
  };
}
