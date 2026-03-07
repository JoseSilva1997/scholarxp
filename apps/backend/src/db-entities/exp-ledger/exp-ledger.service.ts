// Service role: records XP reward events with idempotency guarantees so retries do not duplicate rewards.
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

export type RecordExpLedgerEventParams = {
  userId: number;
  moduleId: number | null;
  moduleUnitId: number | null;
  sessionId: string | null;
  questId: number | null;
  eventType: string;
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
    if (params.awardedExp <= 0) {
      throw new BadRequestException(
        'Awarded experience must be greater than zero.',
      );
    }
    if (params.idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Idempotency key is required.');
    }

    const prismaClient = tx ?? this.prisma;

    try {
      await prismaClient.expLedger.create({
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
        select: { id: true },
      });
      return { created: true, awardedExp: params.awardedExp };
    } catch (error: unknown) {
      // Unique key collisions indicate a replay of an already-recorded reward event.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { created: false, awardedExp: 0 };
      }
      throw error;
    }
  }
}
