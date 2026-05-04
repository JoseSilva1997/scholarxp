// Shared e2e infrastructure for daily-practice suites: app bootstrapping, request helpers, auth overrides, and destructive cleanup.
// Centralizes test app setup, session injection, and database state management to keep suites DRY and mutation-consistent.

import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import type {
  DailyPracticeTodayResponse,
  SubmitDailyPracticeAttemptResponse,
} from '@scholarxp/api-contracts';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthorizationGuard } from '../../src/auth/guards/authorization.guard';
import { SessionAuthGuard } from '../../src/auth/guards/session-auth.guard';
import { DailyPracticeGenerationBatchService } from '../../src/daily-practice/daily-practice-generation-batch.service';
import { DailyPracticeGenerationScheduleService } from '../../src/daily-practice/daily-practice-generation-schedule.service';
import { DAILY_PRACTICE_GENERATION_CRON_NAME } from '../../src/daily-practice/daily-practice-generation-schedule.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { QuestGenerationStartupService } from '../../src/quests/quest-generation-startup.service';

// Represents a single question created during test data seeding.
export type SeededQuestion = {
  questionUnitId: number;
  questionContentId: number;
};

// Represents a lesson unit with associated questions seeded during test data setup.
export type SeededModuleUnit = {
  moduleUnitId: number;
  sortOrder: number;
  questions: SeededQuestion[];
};

// Represents a student enrolled in a module during scenario seeding — the base context for all student-specific scenarios.
export type SeededStudentModuleScenario = {
  studentId: number;
  moduleId: number;
};

// Holds the user ID for the current test context; modified by setAuthenticatedUserId() to simulate different students.
const authContext = {
  userId: 0,
};

// Injects a mock authenticated user into the request context so e2e suites bypass real session middleware.
// Guards check this request-scoped user instead of validating an actual session.
class TestSessionGuard implements CanActivate {
  // Request-scoped auth is injected here so e2e suites can exercise real controllers without session middleware.
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { id: number };
    }>();
    req.user = { id: authContext.userId };
    return true;
  }
}

// Accepts all authorization checks, allowing tests to focus on feature behavior without mocking role hierarchies.
// In production, authorization is enforced; here, only authenticated access is verified.
class TestAuthorizationGuard implements CanActivate {
  // Authorization is not under test here; these suites focus on daily-practice behavior once access is granted.
  canActivate(): boolean {
    return true;
  }
}

// Suppresses startup generation during e2e tests so seeded state is not overwritten by background jobs.
// E2E suites seed state after app boot and expect it to persist for testing.
class TestDailyPracticeGenerationScheduleService extends DailyPracticeGenerationScheduleService {
  // E2E suites seed state after app boot, so suppress startup generation to avoid races with cleanup and assertions.
  override onModuleInit() {}
}

// Creates a test-configured NestApplication with auth/permission mocks, suppressed background jobs, and production validation.
// The resulting app is ready to receive authenticated e2e requests without needing real sessions or authorization checks.
export async function createDailyPracticeE2eApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(SessionAuthGuard)
    .useClass(TestSessionGuard)
    .overrideGuard(AuthorizationGuard)
    .useClass(TestAuthorizationGuard)
    .overrideProvider(DailyPracticeGenerationScheduleService)
    .useClass(TestDailyPracticeGenerationScheduleService)
    // Suppress the startup quest-generation batch so it cannot race against app.close()
    // in afterAll and hit the Prisma pool after it has been torn down.
    .overrideProvider(QuestGenerationStartupService)
    .useValue({ onModuleInit: () => {} })
    .compile();

  const app = moduleFixture.createNestApplication();
  // Production-style validation keeps route coercion and error handling aligned with the runtime that students actually hit.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
  };
}

// Updates the global auth context so subsequent requests appear to come from a specific user.
// Used by test suites to switch authenticated identity between test cases.
export function setAuthenticatedUserId(userId: number) {
  authContext.userId = userId;
}

// Generates today's daily-practice sets (using FSRS algorithm) and fetches them for the authenticated user.
// Calls the batch generator once because e2e suites seed data after app boot (no automatic startup generation).
export async function fetchTodayDailyPractice(
  app: INestApplication,
  moduleId: number,
) {
  // Daily-practice e2e scenarios seed data after app boot, so the batch generator must be kicked once before load-only reads.
  await generateTodayDailyPracticeSets(app);

  const response = await request(app.getHttpServer())
    .get(`/module/${moduleId}/daily-practice/today`)
    .expect(200);

  return response.body as DailyPracticeTodayResponse;
}

// Triggers the batch generation service to create today's daily-practice sets for all students.
export async function generateTodayDailyPracticeSets(app: INestApplication) {
  const generationBatchService = app.get(DailyPracticeGenerationBatchService);

  await generationBatchService.generateDailyPracticeSetsForAllStudents(
    new Date(),
  );
}

// Triggers the scheduled cron job for daily-practice generation to fire immediately.
// Allows e2e tests to verify behavior dependent on scheduled background work without waiting.
export async function fireDailyPracticeGenerationCronJob(
  app: INestApplication,
) {
  const schedulerRegistry = app.get(SchedulerRegistry);
  const cronJob = schedulerRegistry.getCronJob(
    DAILY_PRACTICE_GENERATION_CRON_NAME,
  );

  await Promise.resolve(cronJob.fireOnTick());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Submits a correct MCQ answer for one question in an active daily-practice session.
// All seeded MCQ questions use correctOptionIndex: 0, so selectedOptionIndex: 0 is always correct.
export async function submitDailyPracticeAttemptCorrect(
  app: INestApplication,
  moduleId: number,
  params: {
    setId: string;
    sessionId: string;
    moduleUnitId: number;
    questionUnitId: number;
    questionContentId: number;
  },
): Promise<void> {
  await request(app.getHttpServer())
    .post(`/module/${moduleId}/daily-practice/attempts`)
    .send({
      setId: params.setId,
      sessionId: params.sessionId,
      moduleUnitId: params.moduleUnitId,
      questionUnitId: params.questionUnitId,
      questionContentId: params.questionContentId,
      timeTakenMs: 5000,
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 0 },
    })
    .expect(201);
}

// Submits an incorrect MCQ answer for one question in an active daily-practice session.
// All seeded MCQ questions use correctOptionIndex: 0, so selectedOptionIndex: 1 is always wrong.
// Returns the full response body so callers can assert on encounterGrade, hasCorrectAttempt, etc.
export async function submitDailyPracticeAttemptIncorrect(
  app: INestApplication,
  moduleId: number,
  params: {
    setId: string;
    sessionId: string;
    moduleUnitId: number;
    questionUnitId: number;
    questionContentId: number;
  },
): Promise<SubmitDailyPracticeAttemptResponse> {
  const response = await request(app.getHttpServer())
    .post(`/module/${moduleId}/daily-practice/attempts`)
    .send({
      setId: params.setId,
      sessionId: params.sessionId,
      moduleUnitId: params.moduleUnitId,
      questionUnitId: params.questionUnitId,
      questionContentId: params.questionContentId,
      timeTakenMs: 5000,
      hintUnlocked: false,
      studentAnswer: { selectedOptionIndex: 1 },
    })
    .expect(201);

  return response.body as SubmitDailyPracticeAttemptResponse;
}

// Verifies that DATABASE_URL is defined and appears to be a test database.
// Fails loudly if run in a non-test environment to prevent accidental data destruction.
export function assertSafeE2eDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'E2E safety check failed: DATABASE_URL is not defined before destructive cleanup.',
    );
  }

  const isLikelyTestDb = /(test|e2e)/i.test(databaseUrl);
  if (process.env.E2E_ALLOW_NON_TEST_DATABASE !== 'true' && !isLikelyTestDb) {
    throw new Error(
      'E2E safety check failed: refusing destructive cleanup on a non-test DATABASE_URL.',
    );
  }
}

// Destructively clears all state from the test database in dependency order (respecting foreign key constraints).
// Called by e2e suites in beforeEach/afterEach to ensure a clean database for each test.
// NOTE: Deletion order is critical—tables with foreign keys must be cleared before their referenced tables.
export async function clearDailyPracticeE2eDatabase(prisma: PrismaService) {
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

// Seeds a minimal student, module, and avatar for e2e test scenarios.
// Generates unique identifiers to allow parallel test runs without cross-test contamination.
export async function seedStudentModuleScenario(
  prisma: PrismaService,
): Promise<SeededStudentModuleScenario> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const student = await prisma.user.create({
    data: {
      firstName: 'Daily',
      lastName: 'Practice',
      email: `daily-practice-${uniqueSuffix}@example.com`,
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
      title: `Daily Practice Module ${uniqueSuffix}`,
      description: 'Module used for adaptive daily-practice e2e scenarios.',
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
