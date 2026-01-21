import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModuleService } from './user-module.service';

describe('UserModuleService (integration)', () => {
  let service: UserModuleService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [UserModuleService],
    }).compile();

    service = module.get<UserModuleService>(UserModuleService);
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

  it('creates and retrieves user modules', async () => {
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
        lastName: 'User',
        email: `um-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await service.create({
      moduleId: moduleRow.id,
      userId: user.id,
      roleInModule: 'student',
      userModuleLevel: 1,
      currentExp: 0,
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.userId).toBe(user.id);
  });
});
