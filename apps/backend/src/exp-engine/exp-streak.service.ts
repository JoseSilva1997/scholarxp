// Service role: owns streak reconstruction and ledger writes.
import { Injectable } from '@nestjs/common';
import {
  STREAK_BONUS_EXP_PER_DELTA,
  ExpLedgerEventTypes,
} from '@scholarxp/constants';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpCalculationService } from './exp-calculation.service';
import { AwardStreakBonusParams, PrismaClientLike } from './exp-engine.types';

@Injectable()
export class ExpStreakService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expLedgerService: ExpLedgerService,
    private readonly expCalculationService: ExpCalculationService,
  ) {}

  // Persist each newly reached streak tier as an idempotent delta so retries stay safe under concurrency.
  async awardStreakBonus(
    params: AwardStreakBonusParams,
    tx?: PrismaClientLike,
  ): Promise<number> {
    const prismaClient = tx ?? this.prisma;
    const streakSnapshot = await this.computeStreakSnapshot(
      params.moduleUnitId,
      params.studentId,
      params.sessionId,
      prismaClient,
    );
    const reachedTier = this.expCalculationService.resolveReachedStreakTier(
      streakSnapshot.highestStreak,
      params.totalQuestions,
    );
    if (reachedTier <= 0) {
      return 0;
    }

    let awarded = 0;
    for (let tier = 1; tier <= reachedTier; tier += 1) {
      const tierResult = await this.expLedgerService.recordEvent(
        {
          userId: params.studentId,
          moduleId: params.moduleId,
          moduleUnitId: params.moduleUnitId,
          sessionId: params.sessionId,
          questId: null,
          eventType: ExpLedgerEventTypes.PRACTICE_ROOM_STREAK,
          awardedExp: STREAK_BONUS_EXP_PER_DELTA,
          idempotencyKey: `practice_streak:user:${params.studentId}:unit:${params.moduleUnitId}:tier:${tier}`,
        },
        prismaClient,
      );
      if (tierResult.created) {
        awarded += tierResult.awardedExp;
      }
    }

    return awarded;
  }

  private async computeStreakSnapshot(
    moduleUnitId: number,
    studentId: number,
    sessionId: string,
    prismaClient: PrismaClientLike,
  ): Promise<{ highestStreak: number }> {
    // Rebuild the streak from persisted attempts so rewards are based on canonical history.
    const attempts = await prismaClient.questionAttempt.findMany({
      where: {
        moduleUnitId,
        studentId,
        sessionId,
      },
      orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
      select: {
        questionId: true,
        isCorrect: true,
      },
    });

    const attemptedQuestions = new Set<number>();
    const alreadyCorrectQuestions = new Set<number>();
    let currentStreak = 0;
    let highestStreak = 0;

    for (const attempt of attempts) {
      if (!attempt.isCorrect) {
        // Track that this question has already consumed its "first-attempt correctness" chance.
        attemptedQuestions.add(attempt.questionId);
        currentStreak = 0;
        continue;
      }
      // Re-correct submissions on already solved questions should not inflate streak progression.
      if (alreadyCorrectQuestions.has(attempt.questionId)) {
        continue;
      }
      // Correctness earned on a retry never contributes to streak progression.
      if (attemptedQuestions.has(attempt.questionId)) {
        alreadyCorrectQuestions.add(attempt.questionId);
        continue;
      }
      attemptedQuestions.add(attempt.questionId);
      alreadyCorrectQuestions.add(attempt.questionId);
      currentStreak += 1;
      highestStreak = Math.max(highestStreak, currentStreak);
    }

    return { highestStreak };
  }
}
