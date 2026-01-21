import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionUnitController } from './question-unit.controller';
import { QuestionUnitService } from './question-unit.service';

describe('QuestionUnitController (integration)', () => {
  let controller: QuestionUnitController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [QuestionUnitController],
      providers: [QuestionUnitService],
    }).compile();

    controller = module.get<QuestionUnitController>(QuestionUnitController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.questionUnit.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists question units', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `QUInst-${unique}`,
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
        questionCount: 3,
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
    const coreQuestion = await prisma.questionContent.create({
      data: {
        type: 'mcq',
        questionStem: 'stem',
        questionData: { options: [] },
        difficultyScore: 0.5,
        source: 'test',
        status: 'draft',
      },
    });

    const created = await controller.create({
      coreQuestionId: coreQuestion.id,
      moduleUnitId: moduleUnit.id,
      questionGroupId: questionGroup.id,
      title: 'Question Title',
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((qu) => qu.id === created.id);
    expect(found?.title).toBe('Question Title');
  });
});
