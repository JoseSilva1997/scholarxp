import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TestController } from './test.controller';

describe('TestController', () => {
  let controller: TestController;
  const prisma = {
    user: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = moduleRef.get<TestController>(TestController);
  });

  it('returns the user count from Prisma', async () => {
    (prisma as any).user.count.mockResolvedValue(3);

    const result = await controller.test();

    expect((prisma as any).user.count).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ users: 3 });
  });

  it('propagates Prisma errors', async () => {
    const error = new Error('db unavailable');
    (prisma as any).user.count.mockRejectedValue(error);

    await expect(controller.test()).rejects.toThrow(error);
  });
});
