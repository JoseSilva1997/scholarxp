import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleUnitQuestionGroupController } from './module-unit-question-group.controller';
import { ModuleUnitQuestionGroupService } from './module-unit-question-group.service';

describe('ModuleUnitQuestionGroupController (integration)', () => {
  let controller: ModuleUnitQuestionGroupController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [ModuleUnitQuestionGroupController],
      providers: [ModuleUnitQuestionGroupService],
    }).compile();

    controller = module.get<ModuleUnitQuestionGroupController>(ModuleUnitQuestionGroupController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.moduleUnitQuestionGroup.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists question groups', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `QGInst-${unique}`,
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

    const created = await controller.create({
      moduleUnitId: moduleUnit.id,
      name: 'Group A',
      sortOrder: 1,
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((qg) => qg.id === created.id);
    expect(found?.name).toBe('Group A');
  });
});
