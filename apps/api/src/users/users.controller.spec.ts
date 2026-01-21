import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { randomUUID } from 'crypto';

describe('UsersController (integration)', () => {
  let controller: UsersController;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [UsersController],
      providers: [UsersService],
    }).compile();

    controller = module.get<UsersController>(UsersController);
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

  it('creates then lists users', async () => {
    const email = `controller-${randomUUID()}@example.com`;
    await controller.create({
      firstName: 'Test',
      lastName: 'User',
      email,
      globalRole: 'student' as any,
    });
    createdEmails.push(email);

    const list = await controller.findAll();
    const found = list.find((u) => u.email === email);
    expect(found?.email).toBe(email);
  });
});
