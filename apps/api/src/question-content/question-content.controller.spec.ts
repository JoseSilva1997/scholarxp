import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionContentController } from './question-content.controller';
import { QuestionContentService } from './question-content.service';

describe('QuestionContentController (integration)', () => {
  let controller: QuestionContentController;
  let prisma: PrismaService;
  const createdIds: number[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [QuestionContentController],
      providers: [QuestionContentService],
    }).compile();

    controller = module.get<QuestionContentController>(QuestionContentController);
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

  it('creates then lists question content', async () => {
    const unique = randomUUID();
    const created = await controller.create({
      type: 'mcq',
      questionStem: `Stem ${unique}`,
      questionData: { options: [] },
      hint: null,
      difficultyScore: 0.7,
      source: 'controller-test',
      status: 'draft',
    });
    createdIds.push(created.id);

    const list = await controller.findAll();
    const found = list.find((qc) => qc.id === created.id);
    expect(found?.questionStem).toContain(unique);
  });
});
