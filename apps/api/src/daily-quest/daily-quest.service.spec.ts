import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { DailyQuestService } from './daily-quest.service';

describe('DailyQuestService (integration)', () => {
  let service: DailyQuestService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [DailyQuestService],
    }).compile();

    service = module.get<DailyQuestService>(DailyQuestService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.dailyQuest.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates and retrieves daily quests', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `DQInst-${unique}`,
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
        firstName: 'DQ',
        lastName: 'User',
        email: `dq-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await service.create({
      moduleId: moduleRow.id,
      userId: user.id,
      type: 'challenge',
      expGranted: 10,
      isCompleted: false,
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.type).toBe('challenge');
  });
});
