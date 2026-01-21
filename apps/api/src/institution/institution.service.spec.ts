import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { InstitutionService } from './institution.service';
import { randomUUID } from 'crypto';

describe('InstitutionService (integration)', () => {
  let service: InstitutionService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [InstitutionService],
    }).compile();

    service = module.get<InstitutionService>(InstitutionService);
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

  it('creates and retrieves institutions', async () => {
    const unique = randomUUID();
    const created = await service.create({
      name: 'Inst',
      lmsPlatform: 'canvas',
      lmsIssuerUrl: `https://issuer/${unique}`,
      lmsClientId: `client-${unique}`,
      lmsDeploymentId: `deploy-${unique}`,
      jwksUrl: `https://issuer/${unique}/jwks`,
      authTokenUrl: `https://issuer/${unique}/token`,
      authRequestUrl: `https://issuer/${unique}/auth`,
    });
    expect(created.id).toBeDefined();
    createdIds.push(created.id);

    const all = await service.findAll();
    const found = all.find((i) => i.id === created.id);
    expect(found?.name).toBe('Inst');
  });
});
