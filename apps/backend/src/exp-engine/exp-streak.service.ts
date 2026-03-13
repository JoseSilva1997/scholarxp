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

  // Returns the live streak snapshot for a session so callers can relay both
  // values to the client without re-running streak logic in unrelated services.
  // highestStreak is the authoritative value for determining which tier bonuses
  // have already been claimed (via idempotency keys); currentStreak drives the
  // live visual state.
  async getSessionStreak(
    moduleUnitId: number,
    studentId: number,
    sessionId: string,
    tx?: PrismaClientLike,
  ): Promise<{ currentStreak: number; highestStreak: number }> {
    return this.computeStreakSnapshot(
      moduleUnitId,
      studentId,
      sessionId,
      tx ?? this.prisma,
    );
  }

  private async computeStreakSnapshot(
    moduleUnitId: number,
    studentId: number,
    sessionId: string,
    prismaClient: PrismaClientLike,
  ): Promise<{ highestStreak: number; currentStreak: number }> {
    const historicallySolvedQuestionIds =
      await this.getHistoricallySolvedQuestionIds({
        moduleUnitId,
        studentId,
        sessionId,
        prismaClient,
      });

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

    // Seed with previously solved questions from other sessions so repeat-correct
    // answers on return sessions never inflate streak progression.
    const alreadyCorrectQuestions = new Set<number>(
      historicallySolvedQuestionIds,
    );
    let currentStreak = 0;
    let highestStreak = 0;

    for (const attempt of attempts) {
      if (!attempt.isCorrect) {
        currentStreak = 0;
        continue;
      }
      // Re-correct submissions on already solved questions should not inflate streak progression.
      if (alreadyCorrectQuestions.has(attempt.questionId)) {
        continue;
      }
      // Product rule: a correct retry after a miss still rebuilds streak, but
      // duplicate-correct submissions on the same question are ignored.
      alreadyCorrectQuestions.add(attempt.questionId);
      currentStreak += 1;
      highestStreak = Math.max(highestStreak, currentStreak);
    }

    return { highestStreak, currentStreak };
  }

  // Cross-session solved history prevents "return and re-answer solved question"
  // from counting as new streak progress while still allowing wrong retries to reset streak.
  private async getHistoricallySolvedQuestionIds(input: {
    moduleUnitId: number;
    studentId: number;
    sessionId: string;
    prismaClient: PrismaClientLike;
  }): Promise<number[]> {
    const solvedAttempts = await input.prismaClient.questionAttempt.findMany({
      where: {
        moduleUnitId: input.moduleUnitId,
        studentId: input.studentId,
        isCorrect: true,
        sessionId: { not: input.sessionId },
      },
      select: {
        questionId: true,
      },
      distinct: ['questionId'],
    });
    return solvedAttempts.map((attempt) => attempt.questionId);
  }
}
