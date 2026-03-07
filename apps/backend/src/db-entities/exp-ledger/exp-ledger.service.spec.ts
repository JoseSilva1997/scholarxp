// Spec role: verifies XP ledger idempotency behavior so reward retries stay safe and deterministic.
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExpLedgerService } from './exp-ledger.service';
import { createPrismaMock, type PrismaMock } from '../../test/test-helpers';

describe('ExpLedgerService', () => {
  let service: ExpLedgerService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ExpLedgerService(prisma);
  });

  it('creates a ledger event when idempotency key is new', async () => {
    prisma.expLedger.create.mockResolvedValue({ id: 'evt-1' } as never);

    const result = await service.recordEvent({
      userId: 7,
      moduleId: 11,
      moduleUnitId: 21,
      sessionId: '11111111-1111-4111-8111-111111111111',
      questId: null,
      eventType: 'practice_attempt_module_exp',
      awardedExp: 50,
      idempotencyKey: 'practice_attempt:999:reward_v1:module',
    });

    expect(prisma.expLedger.create).toHaveBeenCalledWith({
      data: {
        userId: 7,
        moduleId: 11,
        moduleUnitId: 21,
        sessionId: '11111111-1111-4111-8111-111111111111',
        questId: null,
        eventType: 'practice_attempt_module_exp',
        awardedExp: 50,
        idempotencyKey: 'practice_attempt:999:reward_v1:module',
      },
      select: { id: true },
    });
    expect(result).toEqual({ created: true, awardedExp: 50 });
  });

  it('returns created=false when idempotency key already exists', async () => {
    prisma.expLedger.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await service.recordEvent({
      userId: 7,
      moduleId: 11,
      moduleUnitId: 21,
      sessionId: '11111111-1111-4111-8111-111111111111',
      questId: null,
      eventType: 'practice_attempt_module_exp',
      awardedExp: 50,
      idempotencyKey: 'practice_attempt:999:reward_v1:module',
    });

    expect(result).toEqual({ created: false, awardedExp: 0 });
  });

  it('rejects non-positive awarded xp', async () => {
    await expect(
      service.recordEvent({
        userId: 7,
        moduleId: null,
        moduleUnitId: null,
        sessionId: null,
        questId: null,
        eventType: 'daily_quest_complete',
        awardedExp: 0,
        idempotencyKey: 'dq:1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.expLedger.create).not.toHaveBeenCalled();
  });
});
