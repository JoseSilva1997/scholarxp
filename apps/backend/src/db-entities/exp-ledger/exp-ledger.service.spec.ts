// Spec role: verifies XP ledger idempotency behavior so reward retries stay safe and deterministic.
import { BadRequestException } from '@nestjs/common';
import { ExpLedgerService } from './exp-ledger.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';
import { ExpLedgerEventTypes } from '@scholarxp/constants';

describe('ExpLedgerService', () => {
  let service: ExpLedgerService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ExpLedgerService(prisma);
  });

  it('creates a ledger event when idempotency key is new', async () => {
    prisma.expLedger.createMany.mockResolvedValue({ count: 1 });

    const result = await service.recordEvent({
      userId: 7,
      moduleId: 11,
      moduleUnitId: 21,
      sessionId: '11111111-1111-4111-8111-111111111111',
      questId: null,
      eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
      awardedExp: 50,
      idempotencyKey: 'practice_attempt:999:reward_v1:module',
    });

    expect(prisma.expLedger.createMany).toHaveBeenCalledWith({
      data: {
        userId: 7,
        moduleId: 11,
        moduleUnitId: 21,
        sessionId: '11111111-1111-4111-8111-111111111111',
        questId: null,
        eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
        awardedExp: 50,
        idempotencyKey: 'practice_attempt:999:reward_v1:module',
      },
      skipDuplicates: true,
    });
    expect(result).toEqual({ created: true, awardedExp: 50 });
  });

  it('returns created=false when idempotency key already exists', async () => {
    prisma.expLedger.createMany.mockResolvedValue({ count: 0 });

    const result = await service.recordEvent({
      userId: 7,
      moduleId: 11,
      moduleUnitId: 21,
      sessionId: '11111111-1111-4111-8111-111111111111',
      questId: null,
      eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
      awardedExp: 50,
      idempotencyKey: 'practice_attempt:999:reward_v1:module',
    });

    expect(result).toEqual({ created: false, awardedExp: 0 });
  });

  it('allows zero-exp completion events', async () => {
    prisma.expLedger.createMany.mockResolvedValue({ count: 1 });

    const result = await service.recordEvent({
      userId: 7,
      moduleId: null,
      moduleUnitId: null,
      sessionId: null,
      questId: null,
      eventType: ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
      awardedExp: 0,
      idempotencyKey: 'completion:0xp',
    });

    expect(result).toEqual({ created: true, awardedExp: 0 });
  });

  it('rejects negative awarded xp', async () => {
    await expect(
      service.recordEvent({
        userId: 7,
        moduleId: null,
        moduleUnitId: null,
        sessionId: null,
        questId: null,
        eventType: ExpLedgerEventTypes.COMPLETE_QUEST,
        awardedExp: -1,
        idempotencyKey: 'dq:1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.expLedger.createMany).not.toHaveBeenCalled();
  });

  it('rejects blank idempotency keys', async () => {
    await expect(
      service.recordEvent({
        userId: 7,
        moduleId: null,
        moduleUnitId: null,
        sessionId: null,
        questId: null,
        eventType: ExpLedgerEventTypes.COMPLETE_QUEST,
        awardedExp: 1,
        idempotencyKey: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.expLedger.createMany).not.toHaveBeenCalled();
  });

  it('counts completed units for the UTC day using the provided transaction client and timestamp', async () => {
    const tx = createPrismaMock();
    tx.expLedger.count.mockResolvedValue(3);
    const timestamp = new Date('2026-04-28T15:30:00.000Z');

    const result = await service.getTodaysNumberOfCompletedUnits(
      7,
      tx,
      timestamp,
    );

    expect(tx.expLedger.count).toHaveBeenCalledWith({
      where: {
        userId: 7,
        eventType: ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
        eventTimestamp: {
          gte: new Date('2026-04-28T00:00:00.000Z'),
          lt: new Date('2026-04-29T00:00:00.000Z'),
        },
      },
    });
    expect(result).toBe(3);
  });

  it('acquires a per-user UTC-day advisory lock', async () => {
    await service.acquireDailyCompletionLock(
      7,
      new Date('2026-04-28T15:30:00.000Z'),
    );

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});
