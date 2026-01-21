import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleUnitController } from './module-unit.controller';
import { ModuleUnitService } from './module-unit.service';

describe('ModuleUnitController (integration)', () => {
  let controller: ModuleUnitController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [ModuleUnitController],
      providers: [ModuleUnitService],
    }).compile();

    controller = module.get<ModuleUnitController>(ModuleUnitController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.moduleUnit.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists module units', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `MUInst-${unique}`,
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

    const created = await controller.create({
      moduleId: moduleRow.id,
      variantContext: `variant-${unique}`,
      title: 'Unit Title',
      questionCount: 5,
      status: 'draft',
      sortOrder: 1,
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((mu) => mu.id === created.id);
    expect(found?.title).toBe('Unit Title');
  });
});
