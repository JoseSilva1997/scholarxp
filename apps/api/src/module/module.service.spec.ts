import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleService } from './module.service';

describe('ModuleService (integration)', () => {
  let service: ModuleService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [ModuleService],
    }).compile();

    service = module.get<ModuleService>(ModuleService);
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

  it('creates and retrieves modules', async () => {
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

    const created = await service.create({
      institutionId: institution.id,
      ltiContextId: `context-${unique}`,
      resourceLinkId: `resource-${unique}`,
      variantContext: `variant-${unique}`,
      title: 'Module Title',
      description: 'Module description',
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.title).toBe('Module Title');
  });
});
