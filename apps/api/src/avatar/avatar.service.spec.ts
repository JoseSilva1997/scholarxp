import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarService } from './avatar.service';

describe('AvatarService (integration)', () => {
  let service: AvatarService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [AvatarService],
    }).compile();

    service = module.get<AvatarService>(AvatarService);
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

  it('creates and fetches avatars', async () => {
    const unique = randomUUID();
    const user = await prisma.user.create({
      data: {
        firstName: 'Avatar',
        lastName: 'User',
        email: `avatar-${unique}@example.com`,
        globalRole: 'student',
      },
    });

    const created = await service.create({
      userId: user.id,
      level: 1,
      currentExp: 0,
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.userId).toBe(user.id);
  });
});
