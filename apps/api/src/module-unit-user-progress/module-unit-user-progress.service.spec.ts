import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleUnitUserProgressService } from './module-unit-user-progress.service';

describe('ModuleUnitUserProgressService (integration)', () => {
  let service: ModuleUnitUserProgressService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [ModuleUnitUserProgressService],
    }).compile();

    service = module.get<ModuleUnitUserProgressService>(ModuleUnitUserProgressService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.moduleUnitUserProgress.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates and retrieves progress rows', async () => {
    const unique = randomUUID();
    const institution = await prisma.institution.create({
      data: {
        name: `MUUPInst-${unique}`,
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
    const moduleUnit = await prisma.moduleUnit.create({
      data: {
        moduleId: moduleRow.id,
        variantContext: `variant-${unique}`,
        title: 'Unit',
        questionCount: 3,
        status: 'draft',
        sortOrder: 1,
      },
    });
    const student = await prisma.user.create({
      data: {
        firstName: 'MUUP',
        lastName: 'Student',
        email: `muup-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await service.create({
      moduleUnitId: moduleUnit.id,
      studentId: student.id,
      currentMasteryScore: 0.5,
      isCompleted: false,
      noOfCorrectAnswers: 2,
      completedAt: null,
      lastPracticedAt: null,
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.studentId).toBe(student.id);
  });
});
