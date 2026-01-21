import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';

describe('ModuleController (integration)', () => {
  let controller: ModuleController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [ModuleController],
      providers: [ModuleService],
    }).compile();

    controller = module.get<ModuleController>(ModuleController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.module.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists modules', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `ModInst-${unique}`,
        lmsPlatform: 'canvas',
        lmsIssuerUrl: `https://issuer/${unique}`,
        lmsClientId: `client-${unique}`,
        lmsDeploymentId: `deploy-${unique}`,
        jwksUrl: `https://issuer/${unique}/jwks`,
        authTokenUrl: `https://issuer/${unique}/token`,
        authRequestUrl: `https://issuer/${unique}/auth`,
      },
    });

    const created = await controller.create({
      institutionId: institution.id,
      ltiContextId: `context-${unique}`,
      resourceLinkId: `resource-${unique}`,
      variantContext: `variant-${unique}`,
      title: 'Module Title',
      description: null,
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((m) => m.id === created.id);
    expect(found?.title).toBe('Module Title');
  });
});
