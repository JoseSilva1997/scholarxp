// Spec role: verifies completion reward policy (100/25/0) and idempotent account XP application.
import { Test, TestingModule } from '@nestjs/testing';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { PracticeRewardService } from './practice-reward.service';
import { ExpLedgerEventTypes } from '@scholarxp/constants';

describe('PracticeRewardService', () => {
  let service: PracticeRewardService;
  let prisma: PrismaMock;
  let expLedgerService: { recordEvent: jest.Mock; getTodaysNumberOfCompletedUnits: jest.Mock };
  let avatarService: { addStudentExp: jest.Mock };

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PracticeRewardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExpLedgerService, useValue: expLedgerService },
        { provide: AvatarService, useValue: avatarService },
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
});
