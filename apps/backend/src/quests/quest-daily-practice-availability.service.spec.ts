// Role: verifies quest generation only targets modules whose daily-practice flow can actually serve a set today.
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DailyPracticeEligibilityService } from '../daily-practice/daily-practice-eligibility.service';
import { DailyPracticeSetReadService } from '../daily-practice/daily-practice-set-read.service';
import { DailyPracticeSetSelectorService } from '../daily-practice/daily-practice-set-selector.service';
import { QuestDailyPracticeAvailabilityService } from './quest-daily-practice-availability.service';

describe('QuestDailyPracticeAvailabilityService', () => {
  let service: QuestDailyPracticeAvailabilityService;
  let dailyPracticeSetReadService: {
    findSetForUtcDay: jest.Mock;
  };
  let dailyPracticeEligibilityService: {
    assertEligibleForToday: jest.Mock;
  };
  let dailyPracticeSetSelectorService: {
    selectQuestions: jest.Mock;
  };

  beforeEach(async () => {
    dailyPracticeSetReadService = {
      findSetForUtcDay: jest.fn().mockResolvedValue(null),
    };
    dailyPracticeEligibilityService = {
      assertEligibleForToday: jest.fn().mockResolvedValue(undefined),
    };
    dailyPracticeSetSelectorService = {
      selectQuestions: jest.fn().mockResolvedValue({
        plan: {
          targetQuestionCount: 3,
          dueReviewQuota: 2,
          reinforcementQuota: 1,
        },
        selectedQuestions: [{ questionUnitId: 101 }],
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuestDailyPracticeAvailabilityService,
        {
          provide: DailyPracticeSetReadService,
          useValue: dailyPracticeSetReadService,
        },
        {
          provide: DailyPracticeEligibilityService,
          useValue: dailyPracticeEligibilityService,
        },
        {
          provide: DailyPracticeSetSelectorService,
          useValue: dailyPracticeSetSelectorService,
        },
      ],
    }).compile();

    service = moduleRef.get(QuestDailyPracticeAvailabilityService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the first module with a persisted non-empty set', async () => {
    dailyPracticeSetReadService.findSetForUtcDay
      .mockResolvedValueOnce({
        id: 'set-1',
        items: [],
      })
      .mockResolvedValueOnce({
        id: 'set-2',
        items: [{ id: 'item-1' }],
      });

    const moduleId = await service.findFirstAvailableModuleId(
      42,
      [3, 7, 9],
      new Date('2026-03-23T12:00:00.000Z'),
    );

    expect(moduleId).toBe(7);
    expect(
      dailyPracticeEligibilityService.assertEligibleForToday,
    ).not.toHaveBeenCalled();
    expect(
      dailyPracticeSetSelectorService.selectQuestions,
    ).not.toHaveBeenCalled();
  });

  it('skips modules that are not yet eligible for daily practice', async () => {
    dailyPracticeEligibilityService.assertEligibleForToday
      .mockRejectedValueOnce(
        new ForbiddenException(
          'Complete your first lesson in this module to unlock daily practice tomorrow.',
        ),
      )
      .mockResolvedValueOnce(undefined);

    const moduleId = await service.findFirstAvailableModuleId(
      42,
      [5, 8],
      new Date('2026-03-23T12:00:00.000Z'),
    );

    expect(moduleId).toBe(8);
    expect(
      dailyPracticeSetSelectorService.selectQuestions,
    ).toHaveBeenCalledTimes(1);
    expect(
      dailyPracticeSetSelectorService.selectQuestions,
    ).toHaveBeenCalledWith({
      userId: 42,
      moduleId: 8,
      now: new Date('2026-03-23T12:00:00.000Z'),
    });
  });

  it('returns null when every eligible module would still produce an empty selection', async () => {
    dailyPracticeSetSelectorService.selectQuestions.mockResolvedValue({
      plan: {
        targetQuestionCount: 0,
        dueReviewQuota: 0,
        reinforcementQuota: 0,
      },
      selectedQuestions: [],
    });

    const moduleId = await service.findFirstAvailableModuleId(
      42,
      [4, 6],
      new Date('2026-03-23T12:00:00.000Z'),
    );

    expect(moduleId).toBeNull();
    expect(
      dailyPracticeSetSelectorService.selectQuestions,
    ).toHaveBeenCalledTimes(2);
  });

  it('rethrows selection errors instead of treating them as unavailable modules', async () => {
    const selectorError = new Error('Selector failed');
    dailyPracticeSetSelectorService.selectQuestions.mockRejectedValue(
      selectorError,
    );

    await expect(
      service.findFirstAvailableModuleId(
        42,
        [5, 8],
        new Date('2026-03-23T12:00:00.000Z'),
      ),
    ).rejects.toThrow(selectorError);

    expect(
      dailyPracticeEligibilityService.assertEligibleForToday,
    ).toHaveBeenCalledTimes(1);
    expect(
      dailyPracticeSetSelectorService.selectQuestions,
    ).toHaveBeenCalledTimes(1);
    expect(
      dailyPracticeEligibilityService.assertEligibleForToday,
    ).not.toHaveBeenCalledWith(8, 42, new Date('2026-03-23T12:00:00.000Z'));
  });
});
