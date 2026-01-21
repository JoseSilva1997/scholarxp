import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModuleController } from './user-module.controller';
import { UserModuleService } from './user-module.service';

describe('UserModuleController (integration)', () => {
  let controller: UserModuleController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [UserModuleController],
      providers: [UserModuleService],
    }).compile();

    controller = module.get<UserModuleController>(UserModuleController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.userModule.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists user modules', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `UMInst-${unique}`,
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
        title: 'Mod',
        description: null,
      },
    });
    const user = await prisma.user.create({
      data: {
        firstName: 'UM',
        lastName: 'Controller',
        email: `um-controller-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await controller.create({
      moduleId: moduleRow.id,
      userId: user.id,
      roleInModule: 'student',
      userModuleLevel: 1,
      currentExp: 0,
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((um) => um.id === created.id);
    expect(found?.userId).toBe(user.id);
  });
});
