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
