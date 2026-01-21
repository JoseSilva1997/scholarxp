import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { randomUUID } from 'crypto';

describe('UsersService (integration)', () => {
  let service: UsersService;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdEmails.length) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails.splice(0, createdEmails.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates and fetches users via Prisma', async () => {
    const email = `service-${randomUUID()}@example.com`;
    const created = await service.create({
      firstName: 'Test',
      lastName: 'User',
      email,
      globalRole: 'student' as any,
    });
    expect(created.id).toBeDefined();
    createdEmails.push(email);

    const all = await service.findAll();
    const found = all.find((u) => u.email === email);
    expect(found?.email).toBe(email);
  });
});
