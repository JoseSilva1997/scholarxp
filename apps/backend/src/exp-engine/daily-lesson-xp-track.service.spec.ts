// Spec role: verifies the standalone daily lesson XP track mirrors the real completion reward rule and state transitions.
import { Test, TestingModule } from '@nestjs/testing';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { ExpCalculationService } from './exp-calculation.service';
import { DailyLessonXpTrackService } from './daily-lesson-xp-track.service';

describe('DailyLessonXpTrackService', () => {
  let service: DailyLessonXpTrackService;
  let expLedgerService: {
    getTodaysNumberOfCompletedUnits: jest.Mock;
  };

  beforeEach(async () => {
    expLedgerService = {
      getTodaysNumberOfCompletedUnits: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyLessonXpTrackService,
        ExpCalculationService,
        {
          provide: ExpLedgerService,
          useValue: expLedgerService,
        },
      ],
    }).compile();

    service = moduleRef.get(DailyLessonXpTrackService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the first reward as active when no lessons have been completed today', async () => {
    expLedgerService.getTodaysNumberOfCompletedUnits.mockResolvedValue(0);
    const timestamp = new Date('2026-03-15T14:20:00.000Z');

    const result = await service.getTrackForUser(42, timestamp);

    expect(
      expLedgerService.getTodaysNumberOfCompletedUnits,
    ).toHaveBeenCalledWith(42, undefined, timestamp);
    expect(result).toEqual({
      dayKeyUtc: '2026-03-15',
      completedLessonsToday: 0,
      nextRewardXp: 100,
      resetsAtUtc: '2026-03-16T00:00:00.000Z',
      steps: [
        {
          key: 'first_completion',
          rewardXp: 100,
          state: 'active',
        },
        {
          key: 'second_completion',
          rewardXp: 25,
          state: 'upcoming',
        },
        {
          key: 'practice',
          rewardXp: 0,
          state: 'upcoming',
        },
      ],
    });
  });

  it('advances the active step after one lesson completion', async () => {
    expLedgerService.getTodaysNumberOfCompletedUnits.mockResolvedValue(1);

    const result = await service.getTrackForUser(
      42,
      new Date('2026-03-15T14:20:00.000Z'),
    );

    expect(result.nextRewardXp).toBe(25);
    expect(result.steps).toEqual([
      {
        key: 'first_completion',
        rewardXp: 100,
        state: 'earned',
      },
      {
        key: 'second_completion',
        rewardXp: 25,
        state: 'active',
      },
      {
        key: 'practice',
        rewardXp: 0,
        state: 'upcoming',
      },
    ]);
  });

  it('switches into practice mode after the rewarded lessons are used', async () => {
    expLedgerService.getTodaysNumberOfCompletedUnits.mockResolvedValue(4);

    const result = await service.getTrackForUser(
      42,
      new Date('2026-03-15T14:20:00.000Z'),
    );

    expect(result.completedLessonsToday).toBe(4);
    expect(result.nextRewardXp).toBe(0);
    expect(result.steps).toEqual([
      {
        key: 'first_completion',
        rewardXp: 100,
        state: 'earned',
      },
      {
        key: 'second_completion',
        rewardXp: 25,
        state: 'earned',
      },
      {
        key: 'practice',
        rewardXp: 0,
        state: 'active',
      },
    ]);
  });
});
