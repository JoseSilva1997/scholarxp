import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeSessionService } from './practice-session.service';

describe('PracticeSessionService (integration)', () => {
  let service: PracticeSessionService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PracticeSessionService],
    }).compile();

    service = module.get<PracticeSessionService>(PracticeSessionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.practiceSession.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates and retrieves practice sessions', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `PSInst-${unique}`,
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
    const user = await prisma.user.create({
      data: {
        firstName: 'PS',
        lastName: 'User',
        email: `ps-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await service.create({
      moduleId: moduleRow.id,
      userId: user.id,
      startTime: new Date().toISOString(),
      endTime: null,
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.userId).toBe(user.id);
  });
});
