// Append-only ledger service for XP reward events. All XP awards across practice sessions,
// quest completions, and mastery events are written here with idempotency guarantees so that
// retried requests and concurrent writes never produce duplicate reward entries.
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DateHelpers } from '../../helpers/helpers';
import { ExpLedgerEventTypes, ExpLedgerEventType } from '@scholarxp/constants';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

export type RecordExpLedgerEventParams = {
  userId: number;
  moduleId: number | null;
  moduleUnitId: number | null;
  sessionId: string | null;
  questId: number | null;
  eventType: ExpLedgerEventType;
  awardedExp: number;
  idempotencyKey: string;
};

export type RecordExpLedgerEventResult = {
  created: boolean;
  awardedExp: number;
};

@Injectable()
export class ExpLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotent insert ensures each logical reward event is persisted once even under concurrent retries.
  async recordEvent(
    params: RecordExpLedgerEventParams,
    tx?: PrismaClientLike,
  ): Promise<RecordExpLedgerEventResult> {
    if (params.awardedExp < 0) {
      throw new BadRequestException(
        'Awarded experience must be zero or greater.',
      );
    }
    if (params.idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Idempotency key is required.');
    }

    const prismaClient = tx ?? this.prisma;

    // Use ON CONFLICT DO NOTHING semantics so duplicate idempotency writes do not abort active transactions.
    const insertResult = await prismaClient.expLedger.createMany({
      data: {
        userId: params.userId,
        moduleId: params.moduleId,
        moduleUnitId: params.moduleUnitId,
        sessionId: params.sessionId,
        questId: params.questId,
        eventType: params.eventType,
        awardedExp: params.awardedExp,
        idempotencyKey: params.idempotencyKey,
      },
      skipDuplicates: true,
    });

    // count===1 means the event was new; count===0 means it was already recorded.
    if (insertResult.count > 0) {
      return { created: true, awardedExp: params.awardedExp };
    }
    return { created: false, awardedExp: 0 };
  }

  // Counts module unit completion events for the current UTC day, used by the daily-practice
  // generation pipeline to determine how many units a student has already finished today.
  async getTodaysNumberOfCompletedUnits(
    userId: number,
    tx?: PrismaClientLike,
    timestamp?: Date,
  ): Promise<number> {
    const prismaClient = tx ?? this.prisma;
    const { dayStartUtc, nextDayStartUtc } = DateHelpers.getUtcDayBounds(
      timestamp || new Date(),
    );

    return prismaClient.expLedger.count({
      where: {
        userId,
        eventType: ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
        eventTimestamp: {
          gte: dayStartUtc,
          lt: nextDayStartUtc,
        },
      },
    });
  }

  // Serialize completion-tier assignment per user/day so concurrent completions cannot both read the same tier.
  async acquireDailyCompletionLock(
    userId: number,
    timestamp: Date,
    tx?: PrismaClientLike,
  ): Promise<void> {
    const prismaClient = tx ?? this.prisma;
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(timestamp);
    // Use a stable UTC-day serial (days since Unix epoch) as the second advisory-lock key component.
    const daySerial = Math.floor(dayStartUtc.getTime() / 86_400_000);

    await prismaClient.$executeRaw`
      SELECT pg_advisory_xact_lock(${userId}, ${daySerial})
    `;
  }
}
