// Service role: owns practice-room reward policy so route orchestration stays thin and reward rules stay testable.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AvatarService } from '../db-entities/avatar/avatar.service';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleService } from '../db-entities/user-module/user-module.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExpLedgerEventTypes,
  STREAK_BONUS_EXP_PER_DELTA,
} from '@scholarxp/constants';
import { ExpCalculationService } from './exp-calculation.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

type AwardCompletionExpParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  completedAt: Date;
};
type AwardAttemptModuleExpParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  questionUnitId: number;
  isCorrect: boolean;
  hadCorrectAttemptBeforeSubmit: boolean;
  hadAnyAttemptBeforeSubmit: boolean;
};

export type AttemptModuleExpRewardResult = {
  moduleExpAwarded: number;
  updatedMembership: Prisma.UserModuleGetPayload<{
    include: { module: true };
  }> | null;
};

@Injectable()
export class ExpAwardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expLedgerService: ExpLedgerService,
    private readonly avatarService: AvatarService,
    private readonly userModuleService: UserModuleService,
    private readonly expCalculationService: ExpCalculationService,
  ) {}

  // Reward module XP for one persisted attempt via idempotent ledger write.
  async awardAttemptModuleExp(
    params: AwardAttemptModuleExpParams,
    tx?: PrismaClientLike,
  ): Promise<AttemptModuleExpRewardResult> {
    // Reuse caller transaction when available so attempt + rewards persist atomically.
    const prismaClient = tx ?? this.prisma;
    // Wrong or repeat-correct submissions do not award question XP.
    if (!params.isCorrect || params.hadCorrectAttemptBeforeSubmit) {
      return {
        moduleExpAwarded: 0,
        updatedMembership: null,
      };
    }

    // Compute question-count context once; all per-question pools depend on this.
    const questionContext = await this.loadQuestionContext(
      params.moduleUnitId,
      prismaClient,
    );
    // No eligible questions means no baseline/bonus payout.
    if (questionContext.totalQuestions <= 0) {
      return {
        moduleExpAwarded: 0,
        updatedMembership: null,
      };
    }

    let totalAwardedExp = 0;
    // Keep last updated membership id to return a response-ready snapshot.
    let updatedMembershipId: number | null = null;

    // Baseline pool (1000) is split across questions; remainder assigned to last question.
    const baselineAward = this.expCalculationService.getBaselineAward(
      questionContext.totalQuestions,
      questionContext.lastQuestionId === params.questionUnitId,
    );
    // Idempotent baseline event prevents duplicate XP for the same user/unit/question.
    const baselineEvent = await this.expLedgerService.recordEvent(
      {
        userId: params.studentId,
        moduleId: params.moduleId,
        moduleUnitId: params.moduleUnitId,
        sessionId: params.sessionId,
        questId: null,
        eventType: ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
        awardedExp: baselineAward,
        idempotencyKey: `practice_answer:user:${params.studentId}:unit:${params.moduleUnitId}:question:${params.questionUnitId}`,
      },
      prismaClient,
    );
    if (baselineEvent.created) {
      // Apply module XP only after ledger confirms this event is newly recorded.
      totalAwardedExp += baselineEvent.awardedExp;
      updatedMembershipId = (
        await this.userModuleService.addStudentModuleExp(
          params.moduleId,
          params.studentId,
          baselineEvent.awardedExp,
          prismaClient,
        )
      ).id;
    }

    // First-attempt bonus only applies when this correct submission was also first-ever attempt.
    if (!params.hadAnyAttemptBeforeSubmit) {
      const firstAttemptAward =
        this.expCalculationService.getFirstAttemptBonusAward(
          questionContext.totalQuestions,
          questionContext.lastQuestionId === params.questionUnitId,
        );
      // Keep first-attempt bonus idempotent at question granularity.
      const firstAttemptEvent = await this.expLedgerService.recordEvent(
        {
          userId: params.studentId,
          moduleId: params.moduleId,
          moduleUnitId: params.moduleUnitId,
          sessionId: params.sessionId,
          questId: null,
          eventType: ExpLedgerEventTypes.PRACTICE_ROOM_CORRECT_AT_FIRST_ATTEMPT,
          awardedExp: firstAttemptAward,
          idempotencyKey: `practice_first_attempt:user:${params.studentId}:unit:${params.moduleUnitId}:question:${params.questionUnitId}`,
        },
        prismaClient,
      );
      if (firstAttemptEvent.created) {
        // Apply first-attempt delta as regular module XP so level math stays centralized.
        totalAwardedExp += firstAttemptEvent.awardedExp;
        updatedMembershipId = (
          await this.userModuleService.addStudentModuleExp(
            params.moduleId,
            params.studentId,
            firstAttemptEvent.awardedExp,
            prismaClient,
          )
        ).id;
      }
    }

    // If no question-level XP event was created, this submission should not advance streak rewards.
    if (totalAwardedExp <= 0) {
      return {
        moduleExpAwarded: 0,
        updatedMembership: null,
      };
    }

    // Streak bonus is computed from session history and awarded as tier deltas.
    const streakBonusAward = await this.awardStreakBonus({
      studentId: params.studentId,
      moduleId: params.moduleId,
      moduleUnitId: params.moduleUnitId,
      sessionId: params.sessionId,
      totalQuestions: questionContext.totalQuestions,
      prismaClient,
    });
    if (streakBonusAward > 0) {
      // Add streak delta to module XP through the same service path.
      totalAwardedExp += streakBonusAward;
      updatedMembershipId = (
        await this.userModuleService.addStudentModuleExp(
          params.moduleId,
          params.studentId,
          streakBonusAward,
          prismaClient,
        )
      ).id;
    }

    // Defensive fallback for duplicate/no-op paths.
    if (!updatedMembershipId || totalAwardedExp <= 0) {
      return {
        moduleExpAwarded: 0,
        updatedMembership: null,
      };
    }

    // Load module include so submit-attempt can map response without extra queries.
    const membershipWithModule = await prismaClient.userModule.findUnique({
      where: { id: updatedMembershipId },
      include: { module: true },
    });

    return {
      moduleExpAwarded: totalAwardedExp,
      updatedMembership: membershipWithModule,
    };
  }

  // Award account XP once when a unit is newly completed, with UTC-day diminishing returns (100/25/0).
  async awardCompletionExp(
    params: AwardCompletionExpParams,
    tx?: PrismaClientLike,
  ): Promise<number> {
    // Share transaction with caller so completion state and rewards commit together.
    const prismaClient = tx ?? this.prisma;

    // Count today's completion-reward events to enforce diminishing daily returns.
    const completionCountToday =
      await this.expLedgerService.getTodaysNumberOfCompletedUnits(
        params.studentId,
        prismaClient,
        params.completedAt,
      );

    // Translate count -> reward tier (100 / 25 / 0).
    const reward =
      this.expCalculationService.resolveDailyCompletionReward(
        completionCountToday,
      );
    // Skip writes entirely for zero-reward tiers.
    if (reward <= 0) {
      return 0;
    }

    // Idempotency by user+unit ensures one completion payout per lesson.
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
    // If event already exists, reward was already applied earlier.
    if (!ledgerResult.created) {
      return 0;
    }

    // Account XP update follows ledger success so audit trail and progression stay in sync.
    await this.avatarService.addStudentExp(
      params.studentId,
      ledgerResult.awardedExp,
      prismaClient,
    );
    return ledgerResult.awardedExp;
  }

  private async loadQuestionContext(
    moduleUnitId: number,
    prismaClient: PrismaClientLike,
  ) {
    // Match practice eligibility rules so XP math aligns with active core questions only.
    const eligibleQuestions = await prismaClient.questionUnit.findMany({
      where: {
        moduleUnitId,
        isArchived: false,
        contents: {
          some: {
            isCore: true,
            isArchived: false,
          },
        },
      },
      orderBy: [{ questionGroupId: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    // Last question id is used for remainder allocation in per-question pools.
    return {
      totalQuestions: eligibleQuestions.length,
      lastQuestionId: eligibleQuestions.at(-1)?.id ?? null,
    };
  }

  private async awardStreakBonus(input: {
    studentId: number;
    moduleId: number;
    moduleUnitId: number;
    sessionId: string;
    totalQuestions: number;
    prismaClient: PrismaClientLike;
  }) {
    // Build streak snapshot from chronological attempts in the current session.
    const streakSnapshot = await this.computeStreakSnapshot(
      input.moduleUnitId,
      input.studentId,
      input.sessionId,
      input.prismaClient,
    );
    const reachedTier = this.expCalculationService.resolveReachedStreakTier(
      streakSnapshot.highestStreak,
      input.totalQuestions,
    );
    // Not enough streak means no streak reward.
    if (reachedTier <= 0) {
      return 0;
    }

    let awarded = 0;
    // Persist each achieved tier as an idempotent delta event (50 each).
    for (let tier = 1; tier <= reachedTier; tier += 1) {
      const tierResult = await this.expLedgerService.recordEvent(
        {
          userId: input.studentId,
          moduleId: input.moduleId,
          moduleUnitId: input.moduleUnitId,
          sessionId: input.sessionId,
          questId: null,
          eventType: ExpLedgerEventTypes.PRACTICE_ROOM_STREAK,
          awardedExp: STREAK_BONUS_EXP_PER_DELTA,
          idempotencyKey: `practice_streak:user:${input.studentId}:unit:${input.moduleUnitId}:tier:${tier}`,
        },
        input.prismaClient,
      );
      if (tierResult.created) {
        // Sum only new tiers; previously-awarded tiers remain no-ops on retries.
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
  ) {
    // Read attempts in submit order so streak progression reflects actual play sequence.
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

    // Keep track of questions already credited as correct to ignore retry-correct inflation.
    const alreadyCorrectQuestions = new Set<number>();
    let currentStreak = 0;
    let highestStreak = 0;

    for (const attempt of attempts) {
      // Any wrong answer resets the running streak immediately.
      if (!attempt.isCorrect) {
        currentStreak = 0;
        continue;
      }
      // Retries on previously corrected questions do not increment streak.
      if (alreadyCorrectQuestions.has(attempt.questionId)) {
        continue;
      }
      alreadyCorrectQuestions.add(attempt.questionId);
      currentStreak += 1;
      // Preserve max streak reached; tiers are based on this peak.
      highestStreak = Math.max(highestStreak, currentStreak);
    }

    return {
      highestStreak,
    };
  }
}
