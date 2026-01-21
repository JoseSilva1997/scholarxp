import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { InstitutionController } from './institution.controller';
import { InstitutionService } from './institution.service';
import { randomUUID } from 'crypto';

describe('InstitutionController (integration)', () => {
  let controller: InstitutionController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [InstitutionController],
      providers: [InstitutionService],
    }).compile();

    controller = module.get<InstitutionController>(InstitutionController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.institution.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists institutions', async () => {
    const unique = randomUUID();
    await controller.create({
      name: 'Inst',
      lmsPlatform: 'canvas',
      lmsIssuerUrl: `https://issuer/${unique}`,
      lmsClientId: `client-${unique}`,
      lmsDeploymentId: `deploy-${unique}`,
      jwksUrl: `https://issuer/${unique}/jwks`,
      authTokenUrl: `https://issuer/${unique}/token`,
      authRequestUrl: `https://issuer/${unique}/auth`,
    });
    const created = await prisma.institution.findFirst({ where: { lmsClientId: `client-${unique}` } });
    if (created) {
      createdIds.push(created.id);
    }

    const list = await controller.findAll();
    const found = list.find((i) => i.lmsClientId === `client-${unique}`);
    expect(found?.name).toBe('Inst');
  });
});
