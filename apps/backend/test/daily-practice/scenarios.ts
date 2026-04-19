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

// Seeds a scenario where the due-review bucket falls short of its quota and the selector must
// backfill with extra reinforcement candidates.
//
// Inventory: 1 due-review question (completed lesson) + 2 reinforcement candidates (started lesson,
// both seen with 'again' grade, not yet due).
// reviewEligible = 1 + 2 = 3 → Math.round(3 × 0.25) = 1 → clamped to MIN = 3.
// Nominal quota at size 3: 2 due_review, 1 reinforcement.
// Due shortfall = 1 → backfill draws the second reinforcement candidate.
// Expected selection: 1 dueReview + 2 reinforcement.
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
    questions: {
      questionUnitId: number;
      questionContentId: number;
      moduleUnitId: number;
    }[];
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
          questionContentId: question.questionContentId,
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
// Seeds a completed lesson with exactly `dueReviewCount` due-review questions and an in-progress
// lesson with one reinforcement candidate (Q0).
//
// reviewEligible = dueReviewCount + 1 reinforcement candidate.
// At dueReviewCount=12 → reviewEligible=13 → Math.round(13×0.25)=3 → size 3.
// At dueReviewCount=13 → reviewEligible=14 → Math.round(14×0.25)=4 → size 4.
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
  const startedLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'In-progress lesson',
      sortOrder: 2,
      questionCount: 1,
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
  // The sizing policy then produces quota: 5 due_review + 1 reinforcement.
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

  // progressLesson: one reinforcement candidate (Q0, seen with 'again' grade, future due).
  const progressLesson = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    {
      title: 'In-progress lesson',
      sortOrder: 2,
      questionCount: 1,
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

  return {
    ...base,
    heavyLesson,
    progressLesson,
    completedAt,
  };
}

// Scenario for testing that due-review candidates from multiple completed lessons all enter
// the same pool and are selected together.
//
// Layout:
//   completedLesson1 (sortOrder 1): 1 due-review question (completed yesterday)
//   completedLesson2 (sortOrder 2): 2 due-review questions (completed yesterday)
//   No started lessons → 0 reinforcement candidates.
//
// reviewEligible = 3 → Math.round(3 × 0.25) = 1 → clamped to MIN = 3
// → quota: 2 dueReview, 1 reinforcement. 0 reinforcement → remainingCount = 1 → backfill from dueReview.
// All 3 due-review candidates (1 from lesson1 + 2 from lesson2) must be selected, proving
// the query spans both lessons rather than being scoped to a single one.
export async function seedStudentMultipleCompletedLessonsScenario(
  prisma: PrismaLike,
  base: SeededStudentModuleScenario,
) {
  const { dayStartUtc } = DateHelpers.getUtcDayBounds(new Date());
  const completedAt = new Date(
    dayStartUtc.getTime() - 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
  );

  // Lesson 1: exactly 1 question — forces this lesson to contribute to the selection
  // (with only 3 total candidates and a target of 3, all must be chosen).
  const completedLesson1 = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    { title: 'First completed lesson', sortOrder: 1, questionCount: 1 },
  );
  await seedCompletedLessonProgress(prisma, {
    moduleUnitId: completedLesson1.moduleUnitId,
    studentId: base.studentId,
    completedAt,
  });
  await seedDueReviewStateForQuestions(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: completedLesson1.moduleUnitId,
    questionIds: completedLesson1.questions.map((q) => q.questionUnitId),
    dueAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
    lastSeenAt: completedAt,
  });

  // Lesson 2: exactly 2 questions — together with lesson 1 this produces exactly MIN = 3 candidates,
  // making the expected lesson distribution (1 from L1, 2 from L2) fully deterministic.
  const completedLesson2 = await seedLiveModuleUnitWithMcqQuestions(
    prisma,
    base.moduleId,
    { title: 'Second completed lesson', sortOrder: 2, questionCount: 2 },
  );
  await seedCompletedLessonProgress(prisma, {
    moduleUnitId: completedLesson2.moduleUnitId,
    studentId: base.studentId,
    completedAt,
  });
  await seedDueReviewStateForQuestions(prisma, {
    studentId: base.studentId,
    moduleId: base.moduleId,
    moduleUnitId: completedLesson2.moduleUnitId,
    questionIds: completedLesson2.questions.map((q) => q.questionUnitId),
    dueAt: new Date(dayStartUtc.getTime() - 2 * 60 * 60 * 1000),
    lastSeenAt: completedAt,
  });

  return { ...base, completedLesson1, completedLesson2, completedAt };
}
