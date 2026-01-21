import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionAttemptService } from './question-attempt.service';

describe('QuestionAttemptService (integration)', () => {
  let service: QuestionAttemptService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [QuestionAttemptService],
    }).compile();

    service = module.get<QuestionAttemptService>(QuestionAttemptService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.questionAttempt.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates and retrieves attempts', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `QAInst-${unique}`,
        lmsPlatform: 'canvas',
        lmsIssuerUrl: `https://issuer/${unique}`,
        lmsClientId: `client-${unique}`,
        lmsDeploymentId: `deploy-${unique}`,
        jwksUrl: `https://issuer/${unique}/jwks`,
        authTokenUrl: `https://issuer/${unique}/token`,
        authRequestUrl: `https://issuer/${unique}/auth`,
      },
    });
    const moduleRow = await prisma.module.create({
      data: {
        institutionId: institution.id,
        ltiContextId: `context-${unique}`,
        resourceLinkId: `resource-${unique}`,
        variantContext: `variant-${unique}`,
        title: 'Module',
        description: null,
      },
    });
    const moduleUnit = await prisma.moduleUnit.create({
      data: {
        moduleId: moduleRow.id,
        variantContext: `variant-${unique}`,
        title: 'Unit',
        questionCount: 1,
        status: 'draft',
        sortOrder: 1,
      },
    });
    const questionGroup = await prisma.moduleUnitQuestionGroup.create({
      data: {
        moduleUnitId: moduleUnit.id,
        name: 'Group',
        sortOrder: 1,
      },
    });
    const coreContent = await prisma.questionContent.create({
      data: {
        type: 'mcq',
        questionStem: 'stem',
        questionData: { options: [] },
        difficultyScore: 0.5,
        source: 'test',
        status: 'draft',
      },
    });
    const questionUnit = await prisma.questionUnit.create({
      data: {
        coreQuestionId: coreContent.id,
        moduleUnitId: moduleUnit.id,
        questionGroupId: questionGroup.id,
        title: 'Q Unit',
      },
    });
    const student = await prisma.user.create({
      data: {
        firstName: 'QA',
        lastName: 'Student',
        email: `qa-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await service.create({
      moduleUnitId: moduleUnit.id,
      studentId: student.id,
      questionId: questionUnit.id,
      contentId: coreContent.id,
      practiceMode: 'practice',
      isCorrect: true,
      timeTakenMs: 1200,
      hintsUsed: 0,
      studentAnswer: { choice: 'A' },
      attemptedAt: new Date().toISOString(),
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.studentId).toBe(student.id);
  });
});
