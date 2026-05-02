// Verifies streak reconstruction and idempotent streak bonus awarding.
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import {
  ExpLedgerEventTypes,
  STREAK_BONUS_EXP_PER_DELTA,
} from '@scholarxp/constants';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { ExpCalculationService } from './exp-calculation.service';
import { ExpStreakService } from './exp-streak.service';

describe('ExpStreakService', () => {
  let prisma: PrismaMock;
  let expLedgerService: { recordEvent: jest.Mock };
  let expCalculationService: { resolveReachedStreakTier: jest.Mock };
  let service: ExpStreakService;

  beforeEach(() => {
    prisma = createPrismaMock();
    expLedgerService = { recordEvent: jest.fn() };
    expCalculationService = { resolveReachedStreakTier: jest.fn() };
    service = new ExpStreakService(
      prisma,
      expLedgerService as unknown as ExpLedgerService,
      expCalculationService as unknown as ExpCalculationService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns zero bonus when no streak tier was reached', async () => {
    prisma.questionAttempt.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ questionId: 1, isCorrect: true }] as never);
    expCalculationService.resolveReachedStreakTier.mockReturnValue(0);

    const awarded = await service.awardStreakBonus({
      moduleId: 2,
      moduleUnitId: 3,
      studentId: 4,
      sessionId: 'session-1',
      totalQuestions: 5,
    });

    expect(awarded).toBe(0);
    expect(expLedgerService.recordEvent).not.toHaveBeenCalled();
  });

  it('awards only newly created streak tier ledger entries', async () => {
    prisma.questionAttempt.findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        { questionId: 1, isCorrect: true },
        { questionId: 2, isCorrect: true },
      ] as never);
    expCalculationService.resolveReachedStreakTier.mockReturnValue(2);
    expLedgerService.recordEvent
      .mockResolvedValueOnce({
        created: true,
        awardedExp: STREAK_BONUS_EXP_PER_DELTA,
      })
      .mockResolvedValueOnce({ created: false, awardedExp: 0 });

    const awarded = await service.awardStreakBonus({
      moduleId: 2,
      moduleUnitId: 3,
      studentId: 4,
      sessionId: 'session-1',
      totalQuestions: 5,
    });

    expect(expLedgerService.recordEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 4,
        eventType: ExpLedgerEventTypes.PRACTICE_ROOM_STREAK,
        idempotencyKey: 'practice_streak:user:4:unit:3:tier:1',
      }),
      prisma,
    );
    expect(awarded).toBe(STREAK_BONUS_EXP_PER_DELTA);
  });

  it('reconstructs session streaks while ignoring historically solved and duplicate-correct questions', async () => {
    prisma.questionAttempt.findMany
      .mockResolvedValueOnce([{ questionId: 1 }] as never)
      .mockResolvedValueOnce([
        { questionId: 1, isCorrect: true },
        { questionId: 2, isCorrect: true },
        { questionId: 2, isCorrect: true },
        { questionId: 3, isCorrect: false },
        { questionId: 4, isCorrect: true },
      ] as never);

    const result = await service.getSessionStreak(3, 4, 'session-1');

    expect(result).toEqual({ currentStreak: 1, highestStreak: 1 });
  });

  it('replays historical practice-room attempts across sessions', async () => {
    prisma.questionAttempt.findMany.mockResolvedValue([
      { sessionId: 'a', questionId: 1, isCorrect: true },
      { sessionId: 'a', questionId: 2, isCorrect: true },
      { sessionId: 'b', questionId: 1, isCorrect: true },
      { sessionId: 'b', questionId: 3, isCorrect: false },
      { sessionId: 'b', questionId: 4, isCorrect: true },
    ] as never);

    const result = await service.getHistoricalHighestPracticeStreak(3, 4);

    expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith({
      where: {
        moduleUnitId: 3,
        studentId: 4,
        session: {
          is: {
            sessionType: PracticeSessionTypeValues.practiceRoom,
          },
        },
      },
      orderBy: [
        { session: { startTime: 'asc' } },
        { attemptedAt: 'asc' },
        { id: 'asc' },
      ],
      select: {
        sessionId: true,
        questionId: true,
        isCorrect: true,
      },
    });
    expect(result).toBe(2);
  });
});
