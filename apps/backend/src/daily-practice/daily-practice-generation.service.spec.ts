// Role: verifies scheduled daily-practice generation stays idempotent and preserves the stable daily snapshot rules.
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { DailyPracticeSelectionBucketValues } from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { DailyPracticeEligibilityService } from './daily-practice-eligibility.service';
import { DailyPracticeGenerationService } from './daily-practice-generation.service';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import { DailyPracticeVariantResolverService } from './daily-practice-variant-resolver.service';

describe('DailyPracticeGenerationService', () => {
  let service: DailyPracticeGenerationService;
  let prisma: PrismaMock;
  let dailyPracticeSetReadService: {
    findSetForUtcDay: jest.Mock;
  };
  let dailyPracticeSetSelectorService: {
    selectQuestions: jest.Mock;
  };
  let dailyPracticeInterleavingService: {
    orderSelectedQuestions: jest.Mock;
  };
  let dailyPracticeEligibilityService: {
    assertEligibleForToday: jest.Mock;
  };
  let dailyPracticeVariantResolverService: {
    resolveQuestionContentIds: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    dailyPracticeSetReadService = {
      findSetForUtcDay: jest.fn(),
    };
    dailyPracticeSetSelectorService = {
      selectQuestions: jest.fn(),
    };
    dailyPracticeInterleavingService = {
      orderSelectedQuestions: jest.fn(),
    };
    dailyPracticeEligibilityService = {
      assertEligibleForToday: jest.fn().mockResolvedValue(undefined),
    };
    dailyPracticeVariantResolverService = {
      resolveQuestionContentIds: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeGenerationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: DailyPracticeSetReadService,
          useValue: dailyPracticeSetReadService,
        },
        {
          provide: DailyPracticeSetSelectorService,
          useValue: dailyPracticeSetSelectorService,
        },
        {
          provide: DailyPracticeInterleavingService,
          useValue: dailyPracticeInterleavingService,
        },
        {
          provide: DailyPracticeEligibilityService,
          useValue: dailyPracticeEligibilityService,
        },
        {
          provide: DailyPracticeVariantResolverService,
          useValue: dailyPracticeVariantResolverService,
        },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeGenerationService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns already_exists when a generated set already exists for the day', async () => {
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(
      buildPersistedSet(),
    );

    const result = await service.ensureSetGenerated(
      7,
      42,
      new Date('2026-03-24T00:00:00.000Z'),
    );

    expect(result).toEqual({ status: 'already_exists' });
    expect(
      dailyPracticeEligibilityService.assertEligibleForToday,
    ).not.toHaveBeenCalled();
    expect(prisma.dailyPracticeSet.create).not.toHaveBeenCalled();
  });

  it('returns no_set when the day already has an empty sentinel row', async () => {
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue({
      ...buildPersistedSet(),
      items: [],
    });

    const result = await service.ensureSetGenerated(
      7,
      42,
      new Date('2026-03-24T00:00:00.000Z'),
    );

    expect(result).toEqual({ status: 'no_set' });
    expect(
      dailyPracticeEligibilityService.assertEligibleForToday,
    ).not.toHaveBeenCalled();
  });

  it('returns ineligible when the student has not unlocked daily practice for the module', async () => {
    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(null);
    dailyPracticeEligibilityService.assertEligibleForToday.mockRejectedValue(
      new ForbiddenException('unlocks tomorrow'),
    );

    const result = await service.ensureSetGenerated(
      7,
      42,
      new Date('2026-03-24T00:00:00.000Z'),
    );

    expect(result).toEqual({ status: 'ineligible' });
    expect(
      dailyPracticeSetSelectorService.selectQuestions,
    ).not.toHaveBeenCalled();
  });

  it('persists an empty sentinel when fewer than the minimum eligible questions exist', async () => {
    const timestamp = new Date('2026-03-24T09:15:00.000Z');

    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(null);
    dailyPracticeSetSelectorService.selectQuestions.mockResolvedValue({
      plan: {
        targetQuestionCount: 0,
        dueReviewQuota: 0,
        newSequenceQuota: 0,
        reinforcementQuota: 0,
      },
      selectedQuestions: [],
    });
    dailyPracticeInterleavingService.orderSelectedQuestions.mockReturnValue([]);
    dailyPracticeVariantResolverService.resolveQuestionContentIds.mockResolvedValue(
      [],
    );
    prisma.dailyPracticeSet.create.mockResolvedValue({ id: 'set-1' } as never);

    const result = await service.ensureSetGenerated(7, 42, timestamp);

    expect(result).toEqual({ status: 'no_set' });
    expect(prisma.dailyPracticeSet.create).toHaveBeenCalledWith({
      data: {
        userId: 42,
        moduleId: 7,
        practiceDateUtc: new Date('2026-03-24T00:00:00.000Z'),
        algorithmVersion: 'fsrs_v1',
      },
      select: { id: true },
    });
  });

  it('creates a persisted set with resolved question content ids when generation succeeds', async () => {
    const timestamp = new Date('2026-03-24T09:15:00.000Z');

    dailyPracticeSetReadService.findSetForUtcDay.mockResolvedValue(null);
    dailyPracticeSetSelectorService.selectQuestions.mockResolvedValue({
      plan: {
        targetQuestionCount: 3,
        dueReviewQuota: 2,
        newSequenceQuota: 0,
        reinforcementQuota: 1,
      },
      selectedQuestions: [buildOrderedQuestion()],
    });
    dailyPracticeInterleavingService.orderSelectedQuestions.mockReturnValue([
      buildOrderedQuestion(),
    ]);
    dailyPracticeVariantResolverService.resolveQuestionContentIds.mockResolvedValue(
      [buildResolvedQuestion()],
    );
    prisma.dailyPracticeSet.create.mockResolvedValue({ id: 'set-1' } as never);

    const result = await service.ensureSetGenerated(7, 42, timestamp);

    expect(result).toEqual({ status: 'created' });
    expect(prisma.dailyPracticeSet.create).toHaveBeenCalledWith({
      data: {
        userId: 42,
        moduleId: 7,
        practiceDateUtc: new Date('2026-03-24T00:00:00.000Z'),
        algorithmVersion: 'fsrs_v1',
        items: {
          create: [
            {
              questionUnitId: 101,
              questionContentId: 601,
              moduleUnitId: 11,
              position: 0,
              selectionReason: 'Overdue review item.',
              selectionScore: 10,
              sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
            },
          ],
        },
      },
      select: { id: true },
    });
  });

  it('treats a create race as already_exists when another request writes the day first', async () => {
    const timestamp = new Date('2026-03-24T09:15:00.000Z');

    dailyPracticeSetReadService.findSetForUtcDay
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildPersistedSet());
    dailyPracticeSetSelectorService.selectQuestions.mockResolvedValue({
      plan: {
        targetQuestionCount: 3,
        dueReviewQuota: 2,
        newSequenceQuota: 0,
        reinforcementQuota: 1,
      },
      selectedQuestions: [buildOrderedQuestion()],
    });
    dailyPracticeInterleavingService.orderSelectedQuestions.mockReturnValue([
      buildOrderedQuestion(),
    ]);
    dailyPracticeVariantResolverService.resolveQuestionContentIds.mockResolvedValue(
      [buildResolvedQuestion()],
    );
    prisma.dailyPracticeSet.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate set.', {
        code: 'P2002',
        clientVersion: '7.4.2',
      }),
    );

    const result = await service.ensureSetGenerated(7, 42, timestamp);

    expect(result).toEqual({ status: 'already_exists' });
  });
});

function buildPersistedSet() {
  return {
    id: '6aa2bc03-a0ee-4ebc-84c5-d6a53b889900',
    userId: 42,
    moduleId: 7,
    practiceDateUtc: new Date('2026-03-24T00:00:00.000Z'),
    generatedAt: new Date('2026-03-24T00:00:01.000Z'),
    completedAt: null,
    algorithmVersion: 'fsrs_v1',
    items: [
      {
        id: 'item-1',
        dailyPracticeSetId: '6aa2bc03-a0ee-4ebc-84c5-d6a53b889900',
        questionUnitId: 101,
        questionContentId: 601,
        moduleUnitId: 11,
        position: 0,
        selectionReason: 'Overdue review item.',
        selectionScore: 10,
        sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
      },
    ],
  };
}

function buildOrderedQuestion() {
  return {
    moduleUnitId: 11,
    moduleUnitTitle: 'Lesson 1',
    moduleUnitSortOrder: 1,
    questionUnitId: 101,
    questionUnitTitle: 'Question 101',
    questionGroupId: 1,
    questionGroupSortOrder: 1,
    coreContentId: 501,
    questionType: 'multiple_choice',
    questionDifficultyScore: 0.5,
    sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
    selectionScore: 10,
    selectionReason: 'Overdue review item.',
    studentQuestionState: null,
    position: 0,
  };
}

function buildResolvedQuestion() {
  return {
    ...buildOrderedQuestion(),
    questionContentId: 601,
  };
}
