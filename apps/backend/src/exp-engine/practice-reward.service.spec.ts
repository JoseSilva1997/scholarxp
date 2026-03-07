// Spec role: verifies completion reward policy (100/25/0) and idempotent account XP application.
import { Test, TestingModule } from '@nestjs/testing';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleService } from '../db-entities/user-module/user-module.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { PracticeRewardService } from './practice-reward.service';
import { ExpLedgerEventTypes } from '@scholarxp/constants';

describe('PracticeRewardService', () => {
  let service: PracticeRewardService;
  let prisma: PrismaMock;
  let expLedgerService: {
    recordEvent: jest.Mock;
    getTodaysNumberOfCompletedUnits: jest.Mock;
  };
  let avatarService: { addStudentExp: jest.Mock };
  let userModuleService: { addStudentModuleExp: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    expLedgerService = {
      recordEvent: jest
        .fn()
        .mockImplementation((params: { awardedExp: number }) =>
          Promise.resolve({ created: true, awardedExp: params.awardedExp }),
        ),
      getTodaysNumberOfCompletedUnits: jest.fn(),
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
        PracticeRewardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExpLedgerService, useValue: expLedgerService },
        { provide: AvatarService, useValue: avatarService },
        { provide: UserModuleService, useValue: userModuleService },
      ],
    }).compile();

    service = module.get<PracticeRewardService>(PracticeRewardService);
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
    expect(expLedgerService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
        awardedExp: 100,
      }),
      prisma,
    );
    expect(avatarService.addStudentExp).toHaveBeenCalledWith(100, 100, prisma);
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
    expect(avatarService.addStudentExp).toHaveBeenCalledWith(100, 25, prisma);
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
  });

  it('awards module xp for a persisted practice attempt and returns updated membership snapshot', async () => {
    const result = await service.awardAttemptModuleExp(
      {
        studentId: 100,
        moduleId: 10,
        moduleUnitId: 20,
        sessionId: '11111111-1111-4111-8111-111111111111',
        attemptId: 9001,
      },
      prisma,
    );

    expect(expLedgerService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
        awardedExp: 50,
        idempotencyKey: 'practice_attempt:9001:reward_v1:module',
      }),
      prisma,
    );
    expect(userModuleService.addStudentModuleExp).toHaveBeenCalledWith(
      10,
      100,
      50,
      prisma,
    );
    expect(result.moduleExpAwarded).toBe(50);
    expect(result.updatedMembership?.module.title).toBe('Biology');
  });

  it('returns zero module xp when attempt ledger event already exists', async () => {
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
        attemptId: 9001,
      },
      prisma,
    );

    expect(result).toEqual({
      moduleExpAwarded: 0,
      updatedMembership: null,
    });
    expect(userModuleService.addStudentModuleExp).not.toHaveBeenCalled();
  });
});
