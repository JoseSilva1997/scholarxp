// Spec role: verifies completion reward policy (100/25/0) and idempotent account XP application.
import { Test, TestingModule } from '@nestjs/testing';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleService } from '../db-entities/user-module/user-module.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { ExpAwardingService } from './exp-awarding.service';
import { ExpCalculationService } from './exp-calculation.service';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
import { ExpQuestionContextService } from './exp-question-context.service';
import { ExpStreakService } from './exp-streak.service';

describe('ExpAwardingService', () => {
  let service: ExpAwardingService;
  let prisma: PrismaMock;
  let expLedgerService: {
    recordEvent: jest.Mock;
    getTodaysNumberOfCompletedUnits: jest.Mock;
    acquireDailyCompletionLock: jest.Mock;
  };
  let avatarService: { addStudentExp: jest.Mock };
  let userModuleService: { addStudentModuleExp: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.$transaction.mockImplementation(
      async (...args: unknown[]): Promise<unknown> => {
        const [firstArg] = args;
        if (typeof firstArg === 'function') {
          return (firstArg as (client: PrismaMock) => Promise<unknown>)(prisma);
        }
        return firstArg;
      },
    );
    expLedgerService = {
      recordEvent: jest
        .fn()
        .mockImplementation((params: { awardedExp: number }) =>
          Promise.resolve({ created: true, awardedExp: params.awardedExp }),
        ),
      getTodaysNumberOfCompletedUnits: jest.fn(),
      acquireDailyCompletionLock: jest.fn().mockResolvedValue(undefined),
    };
    avatarService = {
      addStudentExp: jest.fn().mockResolvedValue(undefined),
    };
    userModuleService = {
      addStudentModuleExp: jest.fn().mockResolvedValue({
        id: 701,
        moduleId: 10,
        userId: 100,
        roleInModule: 'student',
        userModuleLevel: 1,
        currentExp: 40,
        enrolledVia: 'invite',
        createdAt: new Date('2026-03-07T10:00:00.000Z'),
      }),
    };
    prisma.userModule.findUnique.mockResolvedValue({
      id: 701,
      moduleId: 10,
      userId: 100,
      roleInModule: 'student',
      userModuleLevel: 1,
      currentExp: 40,
      enrolledVia: 'invite',
      createdAt: new Date('2026-03-07T10:00:00.000Z'),
      module: {
        id: 10,
        title: 'Biology',
        description: 'Study biology',
      },
    } as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpCalculationService,
        ExpQuestionContextService,
        ExpStreakService,
        ExpAwardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExpLedgerService, useValue: expLedgerService },
        { provide: AvatarService, useValue: avatarService },
        { provide: UserModuleService, useValue: userModuleService },
      ],
    }).compile();

    service = module.get<ExpAwardingService>(ExpAwardingService);
  });

  it('awards 100 account xp on first completion of UTC day', async () => {
    expLedgerService.getTodaysNumberOfCompletedUnits.mockResolvedValue(0);

    const awarded = await service.awardCompletionExp({
      studentId: 100,
      moduleId: 10,
      moduleUnitId: 20,
      sessionId: '11111111-1111-4111-8111-111111111111',
      completedAt: new Date('2026-03-07T15:40:00.000Z'),
    });

    expect(awarded).toBe(100);
    const completionEventCall = expLedgerService.recordEvent.mock.calls.find(
      ([params]) =>
        params.eventType === ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
    );
    expect(completionEventCall?.[0].awardedExp).toBe(100);
    const firstCompletionLockCall =
      expLedgerService.acquireDailyCompletionLock.mock.calls.find(
        ([userId, completedAt]) =>
          userId === 100 &&
          completedAt?.toISOString?.() === '2026-03-07T15:40:00.000Z',
      );
    expect(firstCompletionLockCall).toBeDefined();
    const firstCompletionAvatarCall =
      avatarService.addStudentExp.mock.calls.find(
        ([userId, awardedExp]) => userId === 100 && awardedExp === 100,
      );
    expect(firstCompletionAvatarCall).toBeDefined();
  });

  it('awards 25 account xp on second completion of UTC day', async () => {
    expLedgerService.getTodaysNumberOfCompletedUnits.mockResolvedValue(1);

    const awarded = await service.awardCompletionExp({
      studentId: 100,
      moduleId: 10,
      moduleUnitId: 21,
      sessionId: '11111111-1111-4111-8111-111111111111',
      completedAt: new Date('2026-03-07T16:40:00.000Z'),
    });

    expect(awarded).toBe(25);
    const secondCompletionLockCall =
      expLedgerService.acquireDailyCompletionLock.mock.calls.find(
        ([userId, completedAt]) =>
          userId === 100 &&
          completedAt?.toISOString?.() === '2026-03-07T16:40:00.000Z',
      );
    expect(secondCompletionLockCall).toBeDefined();
    const secondCompletionAvatarCall =
      avatarService.addStudentExp.mock.calls.find(
        ([userId, awardedExp]) => userId === 100 && awardedExp === 25,
      );
    expect(secondCompletionAvatarCall).toBeDefined();
  });

  it('awards 0 account xp from third completion onward in same UTC day', async () => {
    expLedgerService.getTodaysNumberOfCompletedUnits.mockResolvedValue(2);

    const awarded = await service.awardCompletionExp({
      studentId: 100,
      moduleId: 10,
      moduleUnitId: 22,
      sessionId: '11111111-1111-4111-8111-111111111111',
      completedAt: new Date('2026-03-07T18:40:00.000Z'),
    });

    expect(awarded).toBe(0);
    expect(expLedgerService.recordEvent).not.toHaveBeenCalled();
    expect(avatarService.addStudentExp).not.toHaveBeenCalled();
    expect(expLedgerService.acquireDailyCompletionLock).toHaveBeenCalled();
  });

  it('does not apply account xp when completion event was already recorded', async () => {
    expLedgerService.getTodaysNumberOfCompletedUnits.mockResolvedValue(0);
    expLedgerService.recordEvent.mockResolvedValue({
      created: false,
      awardedExp: 0,
    });

    const awarded = await service.awardCompletionExp({
      studentId: 100,
      moduleId: 10,
      moduleUnitId: 20,
      sessionId: '11111111-1111-4111-8111-111111111111',
      completedAt: new Date('2026-03-07T15:40:00.000Z'),
    });

    expect(awarded).toBe(0);
    expect(avatarService.addStudentExp).not.toHaveBeenCalled();
    expect(expLedgerService.acquireDailyCompletionLock).toHaveBeenCalled();
  });

  it('awards module xp for a persisted practice attempt and returns updated membership snapshot', async () => {
    prisma.questionUnit.findMany.mockResolvedValue([
      { id: 201 },
      { id: 202 },
      { id: 203 },
    ] as never);
    prisma.questionAttempt.findMany.mockResolvedValue([
      { questionId: 201, isCorrect: true },
    ] as never);

    const result = await service.awardAttemptModuleExp(
      {
        studentId: 100,
        moduleId: 10,
        moduleUnitId: 20,
        sessionId: '11111111-1111-4111-8111-111111111111',
        questionUnitId: 201,
        isCorrect: true,
        hadCorrectAttemptBeforeSubmit: false,
        hadAnyAttemptBeforeSubmit: false,
      },
      prisma,
    );

    expect(expLedgerService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
        awardedExp: 333,
        idempotencyKey: 'practice_answer:user:100:unit:20:question:201',
      }),
      prisma,
    );
    expect(expLedgerService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ExpLedgerEventTypes.PRACTICE_ROOM_CORRECT_AT_FIRST_ATTEMPT,
        awardedExp: 50,
        idempotencyKey: 'practice_first_attempt:user:100:unit:20:question:201',
      }),
      prisma,
    );
    expect(userModuleService.addStudentModuleExp).toHaveBeenNthCalledWith(
      1,
      10,
      100,
      333,
      prisma,
    );
    expect(userModuleService.addStudentModuleExp).toHaveBeenNthCalledWith(
      2,
      10,
      100,
      50,
      prisma,
    );
    expect(result.moduleExpAwarded).toBe(383);
    expect(result.updatedMembership?.module.title).toBe('Biology');
  });

  it('returns zero module xp when attempt ledger event already exists', async () => {
    prisma.questionUnit.findMany.mockResolvedValue([{ id: 201 }] as never);
    expLedgerService.recordEvent.mockResolvedValue({
      created: false,
      awardedExp: 0,
    });

    const result = await service.awardAttemptModuleExp(
      {
        studentId: 100,
        moduleId: 10,
        moduleUnitId: 20,
        sessionId: '11111111-1111-4111-8111-111111111111',
        questionUnitId: 201,
        isCorrect: true,
        hadCorrectAttemptBeforeSubmit: false,
        hadAnyAttemptBeforeSubmit: false,
      },
      prisma,
    );

    expect(result).toEqual({
      moduleExpAwarded: 0,
      moduleAwards: {
        baseQuestionExp: 0,
        firstAttemptBonus: 0,
        streakBonus: 0,
      },
      updatedMembership: null,
    });
    expect(userModuleService.addStudentModuleExp).not.toHaveBeenCalled();
  });

  it('returns zero for wrong attempts and skips ledger writes', async () => {
    const result = await service.awardAttemptModuleExp(
      {
        studentId: 100,
        moduleId: 10,
        moduleUnitId: 20,
        sessionId: '11111111-1111-4111-8111-111111111111',
        questionUnitId: 201,
        isCorrect: false,
        hadCorrectAttemptBeforeSubmit: false,
        hadAnyAttemptBeforeSubmit: false,
      },
      prisma,
    );

    expect(result).toEqual({
      moduleExpAwarded: 0,
      moduleAwards: {
        baseQuestionExp: 0,
        firstAttemptBonus: 0,
        streakBonus: 0,
      },
      updatedMembership: null,
    });
    expect(expLedgerService.recordEvent).not.toHaveBeenCalled();
  });

  it('scopes streak calculation to the current session only', async () => {
    prisma.questionUnit.findMany.mockResolvedValue([
      { id: 201 },
      { id: 202 },
      { id: 203 },
      { id: 204 },
    ] as never);
    // Only one correct attempt exists in this session, so streak rewards should not trigger.
    prisma.questionAttempt.findMany.mockResolvedValue([
      { questionId: 201, isCorrect: true },
    ] as never);

    await service.awardAttemptModuleExp(
      {
        studentId: 100,
        moduleId: 10,
        moduleUnitId: 20,
        sessionId: '22222222-2222-4222-8222-222222222222',
        questionUnitId: 201,
        isCorrect: true,
        hadCorrectAttemptBeforeSubmit: false,
        hadAnyAttemptBeforeSubmit: false,
      },
      prisma,
    );

    expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionId: '22222222-2222-4222-8222-222222222222',
        }),
      }),
    );
    const streakEventCalls = expLedgerService.recordEvent.mock.calls.filter(
      ([params]) =>
        params.eventType === ExpLedgerEventTypes.PRACTICE_ROOM_STREAK,
    );
    expect(streakEventCalls).toHaveLength(0);
  });

  it('increments streak on retry-correct answers', async () => {
    prisma.questionUnit.findMany.mockResolvedValue([
      { id: 201 },
      { id: 202 },
      { id: 203 },
      { id: 204 },
      { id: 205 },
    ] as never);
    // q1 is corrected on retry (after wrong), then q2/q3 are correct.
    // Product rule: retry-correct answers still contribute to streak rebuilding.
    prisma.questionAttempt.findMany.mockResolvedValue([
      { questionId: 201, isCorrect: false },
      { questionId: 201, isCorrect: true },
      { questionId: 202, isCorrect: true },
      { questionId: 203, isCorrect: true },
    ] as never);

    await service.awardAttemptModuleExp(
      {
        studentId: 100,
        moduleId: 10,
        moduleUnitId: 20,
        sessionId: '33333333-3333-4333-8333-333333333333',
        questionUnitId: 203,
        isCorrect: true,
        hadCorrectAttemptBeforeSubmit: false,
        hadAnyAttemptBeforeSubmit: false,
      },
      prisma,
    );

    const streakEventCalls = expLedgerService.recordEvent.mock.calls.filter(
      ([params]) =>
        params.eventType === ExpLedgerEventTypes.PRACTICE_ROOM_STREAK,
    );
    expect(streakEventCalls).toHaveLength(2);
    expect(streakEventCalls[0]?.[0]).toEqual(
      expect.objectContaining({
        idempotencyKey: 'practice_streak:user:100:unit:20:tier:1',
      }),
    );
    expect(streakEventCalls[1]?.[0]).toEqual(
      expect.objectContaining({
        idempotencyKey: 'practice_streak:user:100:unit:20:tier:2',
      }),
    );
  });
});
