import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { LtiIdentityService } from './lti-identity.service';

describe('LtiIdentityService (integration)', () => {
  let service: LtiIdentityService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [LtiIdentityService],
    }).compile();

    service = module.get<LtiIdentityService>(LtiIdentityService);
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

  it('creates and retrieves lti identities', async () => {
    const unique = randomUUID();

    const createdUser = await prisma.user.create({
      data: {
        firstName: 'LTI',
        lastName: 'User',
        email: `lti-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const createdInstitution = await prisma.institution.create({
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

    const createdIdentity = await service.create({
      institutionId: createdInstitution.id,
      userId: createdUser.id,
      ltiUserId: `lti-user-${unique}`,
    });
    createdIds.push(createdIdentity.id);

    const found = await service.findOne(createdIdentity.id);
    expect(found.ltiUserId).toBe(`lti-user-${unique}`);
  });
});
