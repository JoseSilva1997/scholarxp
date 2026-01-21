import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { TestController } from './test.controller';

describe('TestController (integration)', () => {
  let controller: TestController;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [TestController],
    }).compile();

    controller = module.get<TestController>(TestController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE;');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns user count', async () => {
    const response = await controller.test();
    expect(typeof response.users).toBe('number');
  });
});
