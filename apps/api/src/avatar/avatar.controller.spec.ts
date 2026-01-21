import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';

describe('AvatarController (integration)', () => {
  let controller: AvatarController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [AvatarController],
      providers: [AvatarService],
    }).compile();

    controller = module.get<AvatarController>(AvatarController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.avatar.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates then lists avatars', async () => {
    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        firstName: 'Avatar',
        lastName: 'Controller',
        email: `avatar-controller-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await controller.create({
      userId: user.id,
      level: 3,
      currentExp: 10,
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((a) => a.id === created.id);
    expect(found?.userId).toBe(user.id);
  });
});
