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
    questionIds: heavyLesson.questions.map((question) => question.questionUnitId),
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
