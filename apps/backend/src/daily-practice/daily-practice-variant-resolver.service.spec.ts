// Role: verifies daily-practice content resolution rotates unseen variants without changing question-level selection order.
import { Test, type TestingModule } from '@nestjs/testing';
import { DailyPracticeSelectionBucketValues } from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { DailyPracticeVariantResolverService } from './daily-practice-variant-resolver.service';
import type { OrderedDailyPracticeQuestionRecord } from './daily-practice.types';

describe('DailyPracticeVariantResolverService', () => {
  let service: DailyPracticeVariantResolverService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeVariantResolverService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeVariantResolverService);
  });

  it('chooses the first unseen active variant before falling back to core', async () => {
    prisma.questionVariant.findMany.mockResolvedValue([
      {
        questionUnitId: 101,
        contentId: 601,
      },
      {
        questionUnitId: 101,
        contentId: 602,
      },
    ] as never);
    prisma.questionAttempt.findMany.mockResolvedValue([
      {
        questionId: 101,
        contentId: 601,
      },
    ] as never);

    const result = await service.resolveQuestionContentIds(42, [
      buildOrderedQuestion(),
    ]);

    expect(result[0]?.questionContentId).toBe(602);
  });

  it('falls back to core content when all active variants were already seen', async () => {
    prisma.questionVariant.findMany.mockResolvedValue([
      {
        questionUnitId: 101,
        contentId: 601,
      },
    ] as never);
    prisma.questionAttempt.findMany.mockResolvedValue([
      {
        questionId: 101,
        contentId: 601,
      },
    ] as never);

    const result = await service.resolveQuestionContentIds(42, [
      buildOrderedQuestion(),
    ]);

    expect(result[0]?.questionContentId).toBe(501);
  });

  it('returns an empty list without querying prisma when there is nothing to resolve', async () => {
    const result = await service.resolveQuestionContentIds(42, []);

    expect(result).toEqual([]);
    expect(prisma.questionVariant.findMany).not.toHaveBeenCalled();
    expect(prisma.questionAttempt.findMany).not.toHaveBeenCalled();
  });
});

function buildOrderedQuestion(): OrderedDailyPracticeQuestionRecord {
  return {
    moduleUnitId: 11,
    moduleUnitTitle: 'Lesson 1',
    moduleUnitSortOrder: 1,
    questionUnitId: 101,
    questionUnitTitle: 'Question 101',
    questionGroupId: 1,
    questionGroupSortOrder: 1,
    coreContentId: 501,
    questionType: 'mcq',
    questionDifficultyScore: 0.5,
    sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
    selectionScore: 10,
    selectionReason: 'Overdue review item.',
    studentQuestionState: null,
    position: 0,
  };
}
