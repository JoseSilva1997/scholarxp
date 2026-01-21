import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionContentService } from './question-content.service';

describe('QuestionContentService (integration)', () => {
  let service: QuestionContentService;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [QuestionContentService],
    }).compile();

    service = module.get<QuestionContentService>(QuestionContentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await prisma.questionContent.deleteMany({
        where: { id: { in: createdIds.splice(0, createdIds.length) } },
      });
    }
  });

  afterAll(async () => prisma.$disconnect());

  it('creates and retrieves question content', async () => {
    const unique = randomUUID();
    const created = await service.create({
      type: 'mcq',
      questionStem: `Stem ${unique}`,
      questionData: { options: [] },
      hint: null,
      difficultyScore: 0.5,
      source: 'test',
      status: 'draft',
    });
    createdIds.push(created.id);

    const found = await service.findOne(created.id);
    expect(found.questionStem).toContain(unique);
  });
});
