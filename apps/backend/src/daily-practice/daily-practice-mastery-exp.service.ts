// Awards mastery XP during daily practice as students progress through FSRS spaced repetition stages.
import { Injectable } from '@nestjs/common';
import { FsrsCardStateValues } from '@scholarxp/api-contracts';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleService } from '../db-entities/user-module/user-module.service';
import { ExpQuestionContextService } from '../exp-engine/exp-question-context.service';
import { MASTERY_EXP_CONFIG, type MasteryStage } from './daily-practice-mastery-exp.config';
import type { PrismaClientLike, StudentQuestionStateRecord } from './daily-practice.types';

type EvaluateMasteryParams = {
  userId: number;
  moduleId: number;
  moduleUnitId: number;
  questionUnitId: number;
  sessionId: string;
  updatedState: StudentQuestionStateRecord;
};

type MasteryStageDefinition = {
  stage: MasteryStage;
  eventType: string;
  isEligible: (state: StudentQuestionStateRecord) => boolean;
};

// Stage definitions are ordered so evaluation short-circuits on ineligible stages.
// Each stage fires at most once per question per student, enforced by idempotency keys.
const STAGE_DEFINITIONS: MasteryStageDefinition[] = [
  {
    stage: 'encountered',
    eventType: ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED,
    // Always eligible on first FSRS encounter; idempotency prevents re-award.
    isEligible: () => true,
  },
  {
    stage: 'graduated',
    eventType: ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_GRADUATED,
    // Awarded when the question graduates to the review state (proven short-term retention).
    isEligible: (state) => state.fsrsState === FsrsCardStateValues.review,
  },
  {
    stage: 'retained',
    eventType: ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED,
    // Awarded when FSRS stability crosses the threshold (proven long-term memory).
    isEligible: (state) =>
      state.fsrsStability >= MASTERY_EXP_CONFIG.RETAINED_STABILITY_THRESHOLD,
  },
];

@Injectable()
export class DailyPracticeMasteryExpService {
  constructor(
    private readonly expLedgerService: ExpLedgerService,
    private readonly userModuleService: UserModuleService,
    private readonly expQuestionContextService: ExpQuestionContextService,
  ) {}

  // Evaluates which mastery stages the question now qualifies for and awards XP accordingly.
  // Called once per question per UTC day, right after the FSRS state update.
  async evaluateAndAward(
    params: EvaluateMasteryParams,
    tx?: PrismaClientLike,
  ): Promise<{ masteryExpAwarded: number }> {
    const questionContext =
      await this.expQuestionContextService.getPracticeQuestionContext(
        params.moduleUnitId,
        tx,
      );

    if (questionContext.totalQuestions <= 0) {
      return { masteryExpAwarded: 0 };
    }

    const isLastQuestion =
      questionContext.lastQuestionId === params.questionUnitId;

    let totalAwarded = 0;

    for (const definition of STAGE_DEFINITIONS) {
      if (!definition.isEligible(params.updatedState)) {
        continue;
      }

      const stageAward = this.computeStageAward(
        definition.stage,
        questionContext.totalQuestions,
        isLastQuestion,
      );

      if (stageAward <= 0) {
        continue;
      }

      const idempotencyKey = this.buildIdempotencyKey(
        definition.stage,
        params.userId,
        params.moduleUnitId,
        params.questionUnitId,
      );

      const ledgerResult = await this.expLedgerService.recordEvent(
        {
          userId: params.userId,
          moduleId: params.moduleId,
          moduleUnitId: params.moduleUnitId,
          sessionId: params.sessionId,
          questId: null,
          eventType: definition.eventType,
          awardedExp: stageAward,
          idempotencyKey,
        },
        tx,
      );

      if (ledgerResult.created) {
        totalAwarded += ledgerResult.awardedExp;
        await this.userModuleService.addStudentModuleExp(
          params.moduleId,
          params.userId,
          ledgerResult.awardedExp,
          tx,
        );
      }
    }

    return { masteryExpAwarded: totalAwarded };
  }

  // Per-question share for a stage, with remainder allocated to the last question.
  computeStageAward(
    stage: MasteryStage,
    totalQuestions: number,
    isLastQuestion: boolean,
  ): number {
    const stagePool = MASTERY_EXP_CONFIG.STAGE_POOLS[stage];
    const baseShare = Math.floor(stagePool / totalQuestions);

    if (!isLastQuestion) {
      return baseShare;
    }

    // Last question absorbs the remainder so the pool total reconciles exactly.
    const remainder = stagePool - baseShare * totalQuestions;
    return baseShare + remainder;
  }

  private buildIdempotencyKey(
    stage: MasteryStage,
    userId: number,
    moduleUnitId: number,
    questionUnitId: number,
  ): string {
    return `mastery_${stage}:user:${userId}:unit:${moduleUnitId}:question:${questionUnitId}`;
  }
}
