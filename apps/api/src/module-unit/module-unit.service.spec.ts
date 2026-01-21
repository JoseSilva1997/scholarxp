import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleUnitService } from './module-unit.service';

describe('ModuleUnitService (integration)', () => {
  let service: ModuleUnitService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [ModuleUnitService],
    }).compile();

    service = module.get<ModuleUnitService>(ModuleUnitService);
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

  it('creates and retrieves module units', async () => {
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

    const created = await service.create({
      moduleId: moduleRow.id,
      variantContext: `variant-${unique}`,
      title: 'Unit Title',
      questionCount: 5,
      status: 'draft',
      sortOrder: 1,
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.title).toBe('Unit Title');
  });
});
