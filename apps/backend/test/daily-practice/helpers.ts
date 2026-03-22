// Role: shared e2e helpers for daily-practice suites so app bootstrapping, auth overrides, and destructive test-db cleanup stay consistent.
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
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
import { PrismaService } from '../../src/prisma/prisma.service';

export type SeededQuestion = {
  questionUnitId: number;
  questionContentId: number;
};

export type SeededModuleUnit = {
  moduleUnitId: number;
  sortOrder: number;
  questions: SeededQuestion[];
};

export type SeededStudentModuleScenario = {
  studentId: number;
  moduleId: number;
};

const authContext = {
  userId: 0,
};

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

class TestAuthorizationGuard implements CanActivate {
  // Authorization is not under test here; these suites focus on daily-practice behavior once access is granted.
  canActivate(): boolean {
    return true;
  }
}

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

export function setAuthenticatedUserId(userId: number) {
  authContext.userId = userId;
}

export async function fetchTodayDailyPractice(
  app: INestApplication,
  moduleId: number,
) {
  const response = await request(app.getHttpServer())
    .get(`/module/${moduleId}/daily-practice/today`)
    .expect(200);

  return response.body as DailyPracticeTodayResponse;
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
  await prisma.ltiIdentity.deleteMany();
  await prisma.user.deleteMany();
  await prisma.institution.deleteMany();
}

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
