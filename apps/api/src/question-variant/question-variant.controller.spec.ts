import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionVariantController } from './question-variant.controller';
import { QuestionVariantService } from './question-variant.service';

describe('QuestionVariantController (integration)', () => {
  let controller: QuestionVariantController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [QuestionVariantController],
      providers: [QuestionVariantService],
    }).compile();

    controller = module.get<QuestionVariantController>(QuestionVariantController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.questionVariant.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists variants', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `QVInst-${unique}`,
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
    const questionUnit = await prisma.questionUnit.create({
      data: {
        coreQuestionId: (
          await prisma.questionContent.create({
            data: {
              type: 'mcq',
              questionStem: 'stem',
              questionData: { options: [] },
              difficultyScore: 0.5,
              source: 'test',
              status: 'draft',
            },
          })
        ).id,
        moduleUnitId: moduleUnit.id,
        questionGroupId: questionGroup.id,
        title: 'Q Unit',
      },
    });
    const variantContent = await prisma.questionContent.create({
      data: {
        type: 'mcq',
        questionStem: 'variant stem',
        questionData: { options: [] },
        difficultyScore: 0.55,
        source: 'test',
        status: 'draft',
      },
    });

    const created = await controller.create({
      questionUnitId: questionUnit.id,
      contentId: variantContent.id,
      variantLabel: 'B',
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((qv) => qv.id === created.id);
    expect(found?.questionUnitId).toBe(questionUnit.id);
  });
});
