import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { DailyQuestController } from './daily-quest.controller';
import { DailyQuestService } from './daily-quest.service';

describe('DailyQuestController (integration)', () => {
  let controller: DailyQuestController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [DailyQuestController],
      providers: [DailyQuestService],
    }).compile();

    controller = module.get<DailyQuestController>(DailyQuestController);
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

  it('creates then lists daily quests', async () => {
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
        lastName: 'Controller',
        email: `dq-controller-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await controller.create({
      moduleId: moduleRow.id,
      userId: user.id,
      type: 'challenge',
      expGranted: 15,
      isCompleted: false,
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((dq) => dq.id === created.id);
    expect(found?.type).toBe('challenge');
  });
});
