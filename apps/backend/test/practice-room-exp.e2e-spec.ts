// Role: validates practice-room XP policy end-to-end through HTTP routes and persisted ledger/account side effects.
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GlobalRole, ModuleUnitStatus } from '@prisma/client';
import type { SubmitAttemptResponse } from '@scholarxp/api-contracts';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthorizationGuard } from '../src/auth/guards/authorization.guard';
import { SessionAuthGuard } from '../src/auth/guards/session-auth.guard';
import { DailyPracticeGenerationScheduleService } from '../src/daily-practice/daily-practice-generation-schedule.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { QuestGenerationStartupService } from '../src/quests/quest-generation-startup.service';

type SeededQuestion = {
  questionUnitId: number;
  questionContentId: number;
};

type SeededModuleUnit = {
  moduleUnitId: number;
  questions: SeededQuestion[];
};

// Shared mutable auth context lets guard overrides inject the seeded user id per test.
const authContext = {
  userId: 0,
};

class TestSessionGuard implements CanActivate {
  // We set request.user in the guard so controller handlers can read user.id without session middleware.
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { id: number };
    }>();
    req.user = { id: authContext.userId };
    return true;
  }
}

class TestAuthorizationGuard implements CanActivate {
  // Authorization is not under test here; this suite focuses only on reward behavior after access is granted.
  canActivate(): boolean {
    return true;
  }
}

describe('Practice room XP policy (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(SessionAuthGuard)
      .useClass(TestSessionGuard)
      .overrideGuard(AuthorizationGuard)
      .useClass(TestAuthorizationGuard)
      // Suppress startup generation batches so this suite's teardown cannot race them against Prisma shutdown.
      .overrideProvider(DailyPracticeGenerationScheduleService)
      .useValue({ onModuleInit: () => {} })
      .overrideProvider(QuestGenerationStartupService)
      .useValue({ onModuleInit: () => {} })
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror runtime validation behavior so DTO coercion/parsing in e2e matches production.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    assertSafeE2eDatabaseUrl();
    await clearDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('distributes baseline with floor+remainder and applies first-attempt bonus only once', async () => {
    const seed = await seedStudentModuleScenario(prisma);
    authContext.userId = seed.studentId;
    const unit = await seedModuleUnitWithMcqQuestions(prisma, seed.moduleId, {
      title: 'Unit A',
      questionCount: 3,
    });

    const sessionId = await openPracticeRoomSession(
      app,
      seed.moduleId,
      unit.moduleUnitId,
    );

    const [q1, q2, q3] = unit.questions;

    const first = await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      sessionId,
      q1,
      0,
    );
    expect(getAwardedModuleExp(first)).toBe(383); // baseline 333 + first-attempt bonus 50

    const secondWrong = await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      sessionId,
      q2,
      1,
    );
    expect(getAwardedModuleExp(secondWrong)).toBe(0);

    const secondCorrect = await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      sessionId,
      q2,
      0,
    );
    expect(getAwardedModuleExp(secondCorrect)).toBe(333); // first-attempt bonus blocked after prior wrong attempt

    const thirdWrong = await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      sessionId,
      q3,
      1,
    );
    expect(getAwardedModuleExp(thirdWrong)).toBe(0);

    const thirdCorrect = await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      sessionId,
      q3,
      0,
    );
    expect(getAwardedModuleExp(thirdCorrect)).toBe(334); // remainder is assigned to last question

    const baselineEvents = await prisma.expLedger.findMany({
      where: {
        userId: seed.studentId,
        moduleUnitId: unit.moduleUnitId,
        eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
      },
      orderBy: { eventTimestamp: 'asc' },
    });
    expect(baselineEvents.map((entry) => entry.awardedExp)).toEqual([
      333, 333, 334,
    ]);

    const firstAttemptEvents = await prisma.expLedger.findMany({
      where: {
        userId: seed.studentId,
        moduleUnitId: unit.moduleUnitId,
        eventType: ExpLedgerEventTypes.PRACTICE_ROOM_CORRECT_AT_FIRST_ATTEMPT,
      },
    });
    expect(firstAttemptEvents).toHaveLength(1);
    expect(firstAttemptEvents[0]?.awardedExp).toBe(50);

    const streakEvents = await prisma.expLedger.findMany({
      where: {
        userId: seed.studentId,
        moduleUnitId: unit.moduleUnitId,
        eventType: ExpLedgerEventTypes.PRACTICE_ROOM_STREAK,
      },
    });
    expect(streakEvents).toHaveLength(0);
  });

  it('breaks streak progression when the user leaves and starts a new session', async () => {
    const seed = await seedStudentModuleScenario(prisma);
    authContext.userId = seed.studentId;
    const unit = await seedModuleUnitWithMcqQuestions(prisma, seed.moduleId, {
      title: 'Unit B',
      questionCount: 5,
    });

    const firstSessionId = await openPracticeRoomSession(
      app,
      seed.moduleId,
      unit.moduleUnitId,
    );
    await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      firstSessionId,
      unit.questions[0],
      0,
    );
    await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      firstSessionId,
      unit.questions[1],
      0,
    );

    await request(app.getHttpServer())
      .post(
        `/module/${seed.moduleId}/unit/${unit.moduleUnitId}/practice-room/session/${firstSessionId}/close`,
      )
      .expect(201);

    const secondSessionId = await openPracticeRoomSession(
      app,
      seed.moduleId,
      unit.moduleUnitId,
    );
    expect(secondSessionId).not.toBe(firstSessionId);

    await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      secondSessionId,
      unit.questions[2],
      0,
    );

    const streakEvents = await prisma.expLedger.findMany({
      where: {
        userId: seed.studentId,
        moduleUnitId: unit.moduleUnitId,
        eventType: ExpLedgerEventTypes.PRACTICE_ROOM_STREAK,
      },
    });
    // Without session scoping this sequence would reach streak=3 and award tiers; expected behavior is no streak reward.
    expect(streakEvents).toHaveLength(0);
  });

  it('awards completion account XP with daily diminishing returns (100, 25, 0)', async () => {
    const seed = await seedStudentModuleScenario(prisma);
    authContext.userId = seed.studentId;

    const firstUnit = await seedModuleUnitWithMcqQuestions(
      prisma,
      seed.moduleId,
      {
        title: 'Unit C1',
        questionCount: 1,
      },
    );
    const secondUnit = await seedModuleUnitWithMcqQuestions(
      prisma,
      seed.moduleId,
      {
        title: 'Unit C2',
        questionCount: 1,
      },
    );
    const thirdUnit = await seedModuleUnitWithMcqQuestions(
      prisma,
      seed.moduleId,
      {
        title: 'Unit C3',
        questionCount: 1,
      },
    );

    await completeSingleQuestionUnit(app, seed.moduleId, firstUnit);
    await completeSingleQuestionUnit(app, seed.moduleId, secondUnit);
    await completeSingleQuestionUnit(app, seed.moduleId, thirdUnit);

    const completionEvents = await prisma.expLedger.findMany({
      where: {
        userId: seed.studentId,
        eventType: ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
      },
      orderBy: { eventTimestamp: 'asc' },
    });
    expect(completionEvents.map((entry) => entry.awardedExp)).toEqual([
      100, 25, 0,
    ]);

    const avatar = await prisma.avatar.findUnique({
      where: { userId: seed.studentId },
      select: { totalExp: true },
    });
    expect(avatar?.totalExp).toBe(125);
  });

  it('does not duplicate question XP when the same question is submitted correctly again', async () => {
    const seed = await seedStudentModuleScenario(prisma);
    authContext.userId = seed.studentId;
    const unit = await seedModuleUnitWithMcqQuestions(prisma, seed.moduleId, {
      title: 'Unit D',
      // Use >1 question so first correct attempt does not auto-complete the unit before retry validation.
      questionCount: 2,
    });

    const sessionId = await openPracticeRoomSession(
      app,
      seed.moduleId,
      unit.moduleUnitId,
    );
    const question = unit.questions[0];

    const first = await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      sessionId,
      question,
      0,
    );
    expect(getAwardedModuleExp(first)).toBe(575); // baseline 500 + first-attempt bonus 75

    const retry = await submitAttempt(
      app,
      seed.moduleId,
      unit.moduleUnitId,
      sessionId,
      question,
      0,
    );
    expect(getAwardedModuleExp(retry)).toBe(0);

    const baselineEvents = await prisma.expLedger.findMany({
      where: {
        userId: seed.studentId,
        moduleUnitId: unit.moduleUnitId,
        eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
      },
    });
    expect(baselineEvents).toHaveLength(1);

    const firstAttemptEvents = await prisma.expLedger.findMany({
      where: {
        userId: seed.studentId,
        moduleUnitId: unit.moduleUnitId,
        eventType: ExpLedgerEventTypes.PRACTICE_ROOM_CORRECT_AT_FIRST_ATTEMPT,
      },
    });
    expect(firstAttemptEvents).toHaveLength(1);
  });
});

function assertSafeE2eDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'E2E safety check failed: DATABASE_URL is not defined before destructive cleanup.',
    );
  }

  // This suite clears many tables; enforce a second local guard even if setup-env is bypassed.
  const isLikelyTestDb = /(test|e2e)/i.test(databaseUrl);
  if (process.env.E2E_ALLOW_NON_TEST_DATABASE !== 'true' && !isLikelyTestDb) {
    throw new Error(
      'E2E safety check failed: refusing destructive cleanup on a non-test DATABASE_URL.',
    );
  }
}

// Creates one student with avatar + module enrollment so reward writes have all required persistence rows.
async function seedStudentModuleScenario(prisma: PrismaService) {
  const uniqueSuffix = Date.now().toString();
  const student = await prisma.user.create({
    data: {
      firstName: 'XP',
      lastName: 'Student',
      email: `xp-student-${uniqueSuffix}@example.com`,
      globalRole: GlobalRole.student,
      isVerified: true,
    },
  });
  await prisma.avatar.create({
    data: {
      userId: student.id,
      totalExp: 0,
    },
  });
  const module = await prisma.module.create({
    data: {
      title: `XP Module ${uniqueSuffix}`,
      description: 'Practice module for XP e2e scenarios',
      createdByUserId: student.id,
    },
  });
  await prisma.userModule.create({
    data: {
      moduleId: module.id,
      userId: student.id,
      roleInModule: 'student',
      userModuleLevel: 1,
      currentExp: 0,
    },
  });

  return {
    studentId: student.id,
    moduleId: module.id,
  };
}

// Seeds one module unit with N core MCQ questions so practice-room submit and grading can run without mocks.
async function seedModuleUnitWithMcqQuestions(
  prisma: PrismaService,
  moduleId: number,
  input: {
    title: string;
    questionCount: number;
  },
): Promise<SeededModuleUnit> {
  const moduleUnit = await prisma.moduleUnit.create({
    data: {
      moduleId,
      title: input.title,
      questionCount: input.questionCount,
      status: ModuleUnitStatus.live,
      // Any deterministic integer is valid here; ordering is irrelevant for this isolated e2e flow.
      sortOrder: 1,
    },
  });

  const questions: SeededQuestion[] = [];
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
        questionStem: `Question ${index + 1}`,
        questionData: {
          options: [{ optionText: 'Correct' }, { optionText: 'Wrong' }],
          correctOptionIndex: 0,
        },
        hint: null,
        source: 'seeded-e2e',
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
    questions,
  };
}

// Uses the real GET endpoint so session creation behavior matches production before attempt submissions.
async function openPracticeRoomSession(
  app: INestApplication,
  moduleId: number,
  moduleUnitId: number,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .get(`/module/${moduleId}/unit/${moduleUnitId}/practice-room`)
    .expect(200);

  return response.body.practiceRoom.sessionId as string;
}

// Posts one attempt through the public API and returns the contract response for assertions.
async function submitAttempt(
  app: INestApplication,
  moduleId: number,
  moduleUnitId: number,
  sessionId: string,
  question: SeededQuestion,
  selectedOptionIndex: number,
) {
  const response = await request(app.getHttpServer())
    .post(`/module/${moduleId}/unit/${moduleUnitId}/practice-room/attempts`)
    .send({
      moduleUnitId,
      questionUnitId: question.questionUnitId,
      questionContentId: question.questionContentId,
      sessionId,
      timeTakenMs: 900,
      hintUnlocked: false,
      studentAnswer: {
        selectedOptionIndex,
      },
    })
    .expect(201);

  return response.body as SubmitAttemptResponse;
}

// Submit responses now separate module XP from account XP, so tests derive the
// legacy per-attempt module total from the structured reward buckets.
function getAwardedModuleExp(response: SubmitAttemptResponse): number {
  return (
    response.awards.baseQuestionExp +
    response.awards.firstAttemptBonus +
    response.awards.streakBonus
  );
}

// Completes a 1-question unit through real endpoints to trigger completion XP policy evaluation.
async function completeSingleQuestionUnit(
  app: INestApplication,
  moduleId: number,
  unit: SeededModuleUnit,
) {
  const sessionId = await openPracticeRoomSession(
    app,
    moduleId,
    unit.moduleUnitId,
  );
  await submitAttempt(
    app,
    moduleId,
    unit.moduleUnitId,
    sessionId,
    unit.questions[0],
    0,
  );
}

// Explicit cleanup keeps e2e runs deterministic regardless of prior local test state.
async function clearDatabase(prisma: PrismaService) {
  await prisma.dailyPracticeSetItem.deleteMany();
  await prisma.dailyPracticeSet.deleteMany();
  await prisma.studentQuestionState.deleteMany();
  await prisma.expLedger.deleteMany();
  await prisma.questionAttempt.deleteMany();
  await prisma.moduleUnitUserProgress.deleteMany();
  await prisma.questionVariant.deleteMany();
  await prisma.questionContent.deleteMany();
  await prisma.questionUnit.deleteMany();
  await prisma.moduleUnitQuestionGroup.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.dailyQuest.deleteMany();
  await prisma.moduleInvite.deleteMany();
  await prisma.moduleUnit.deleteMany();
  await prisma.userModule.deleteMany();
  await prisma.avatar.deleteMany();
  await prisma.module.deleteMany();
  await prisma.userPassword.deleteMany();
  await prisma.authIdentity.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.user.deleteMany();
}
