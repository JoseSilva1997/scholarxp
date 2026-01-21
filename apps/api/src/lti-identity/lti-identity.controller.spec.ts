import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { LtiIdentityController } from './lti-identity.controller';
import { LtiIdentityService } from './lti-identity.service';

describe('LtiIdentityController (integration)', () => {
  let controller: LtiIdentityController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [LtiIdentityController],
      providers: [LtiIdentityService],
    }).compile();

    controller = module.get<LtiIdentityController>(LtiIdentityController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.ltiIdentity.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists identities', async () => {
    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        firstName: 'LTI',
        lastName: 'User',
        email: `controller-lti-${unique}@example.com`,
        globalRole: 'student',
      },
    });
    const institution = await prisma.institution.create({
      data: {
        name: `Inst-${unique}`,
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
      userId: user.id,
      ltiUserId: `controller-${unique}`,
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((li) => li.id === created.id);
    expect(found?.ltiUserId).toBe(`controller-${unique}`);
  });
});
