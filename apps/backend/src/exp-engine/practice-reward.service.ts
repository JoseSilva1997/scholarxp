// Service role: owns practice-room reward policy so route orchestration stays thin and reward rules stay testable.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpLedgerEventTypes } from '@scholarxp/constants';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

type AwardCompletionExpParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  completedAt: Date;
};
const FIRST_COMPLETION_REWARD = 100;
const SECOND_COMPLETION_REWARD = 25;

@Injectable()
export class PracticeRewardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expLedgerService: ExpLedgerService,
    private readonly avatarService: AvatarService,
  ) {}

  // Award account XP once when a unit is newly completed, with UTC-day diminishing returns (100/25/0).
  async awardCompletionExp(
    params: AwardCompletionExpParams,
    tx?: PrismaClientLike,
  ): Promise<number> {
    const prismaClient = tx ?? this.prisma;

    const completionCountToday =
      await this.expLedgerService.getTodaysNumberOfCompletedUnits(
        params.studentId,
        prismaClient,
        params.completedAt,
      );

    const reward = this.resolveDailyCompletionReward(completionCountToday);
    if (reward <= 0) {
      return 0;
    }

    const idempotencyKey = `completion_exp:user:${params.studentId}:unit:${params.moduleUnitId}`;
    const ledgerResult = await this.expLedgerService.recordEvent(
      {
        userId: params.studentId,
        moduleId: params.moduleId,
        moduleUnitId: params.moduleUnitId,
        sessionId: params.sessionId,
        questId: null,
        eventType: ExpLedgerEventTypes.COMPLETE_MODULE_UNIT,
        awardedExp: reward,
        idempotencyKey,
      },
      prismaClient,
    );
    if (!ledgerResult.created) {
      return 0;
    }

    await this.avatarService.addStudentExp(
      params.studentId,
      ledgerResult.awardedExp,
      prismaClient,
    );
    return ledgerResult.awardedExp;
  }

  private resolveDailyCompletionReward(completionCountToday: number) {
    if (completionCountToday <= 0) {
      return FIRST_COMPLETION_REWARD;
    }
    if (completionCountToday === 1) {
      return SECOND_COMPLETION_REWARD;
    }
    return 0;
  }
}
