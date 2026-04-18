// Role: persists daily-practice FSRS updates — gates first-encounter creation on the first correct attempt and defers day-level scheduling policy to DailyPracticeFsrsPolicyService.
import { Injectable } from '@nestjs/common';
import { DailyPracticeAlgorithmVersionValues } from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
import {
  DailyPracticeFsrsPolicyService,
  type AcquisitionEvidence,
  type PolicyCardUpdate,
} from './daily-practice-fsrs-policy.service';
import type {
  PrismaClientLike,
  StudentQuestionStateRecord,
} from './daily-practice.types';

type ApplyDailyPracticeEncounterParams = {
  userId: number;
  moduleId: number;
  moduleUnitId: number;
  questionUnitId: number;
  reviewedAt: Date;
  firstAttemptCorrect: boolean;
  hintUnlocked: boolean;
  timeTakenMs: number;
  // Caller-provided so the same timezone used for eligibility + set windowing also drives due-date snapping.
  timezone: string;
  // True when the learner already attempted this question within the caller's grading window (session for lessons, day for daily practice). Gates re-grading of an already-seeded card while still permitting late seeding when the first attempts were incorrect.
  priorEncounterExists: boolean;
};

@Injectable()
export class DailyPracticeFsrsStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionStateReadService: DailyPracticeQuestionStateReadService,
    private readonly fsrsGradeService: DailyPracticeFsrsGradeService,
    private readonly policyService: DailyPracticeFsrsPolicyService,
  ) {}

  // One normalized encounter becomes at most one FSRS review update. First-ever incorrect encounters record the attempt but defer state creation to the first correct encounter, where acquisition evidence seeds the initial memory state.
  async applyEncounter(
    params: ApplyDailyPracticeEncounterParams,
    tx?: PrismaClientLike,
  ): Promise<StudentQuestionStateRecord | null> {
    const prismaClient = tx ?? this.prisma;
    const existingState =
      await this.questionStateReadService.findStateForQuestion(
        params.userId,
        params.questionUnitId,
        prismaClient,
      );

    // Once a card is seeded, the caller's grading window (session/day) caps real FSRS transitions at one — extra retries within the same window must not re-grade.
    if (existingState && params.priorEncounterExists) {
      return null;
    }

    const grade = this.fsrsGradeService.mapEncounterToGrade({
      firstAttemptCorrect: params.firstAttemptCorrect,
      hintUnlocked: params.hintUnlocked,
    });

    if (!existingState) {
      if (!params.firstAttemptCorrect) {
        // Defer seeding until the first successful encounter — recording failed first attempts as FSRS state distorts stability for questions the learner has not yet acquired.
        return null;
      }

      const evidence = await this.loadAcquisitionEvidence(
        prismaClient,
        params.userId,
        params.questionUnitId,
      );
      const seed = this.policyService.computeSeedStateForFirstCorrect({
        grade,
        reviewedAt: params.reviewedAt,
        timezone: params.timezone,
        evidence,
      });

      return this.persistCreate(prismaClient, params, grade, seed);
    }

    const nextCard = this.policyService.computeNextStateForExisting({
      existingState,
      grade,
      reviewedAt: params.reviewedAt,
      timezone: params.timezone,
    });

    return this.persistUpdate(
      prismaClient,
      params,
      grade,
      nextCard,
      existingState,
    );
  }

  private async persistCreate(
    prismaClient: PrismaClientLike,
    params: ApplyDailyPracticeEncounterParams,
    grade: ReturnType<DailyPracticeFsrsGradeService['mapEncounterToGrade']>,
    seed: PolicyCardUpdate,
  ): Promise<StudentQuestionStateRecord> {
    const recentAvgTimeMs = this.updateRecentAverageTimeMs(
      null,
      params.timeTakenMs,
    );

    return prismaClient.studentQuestionState.upsert({
      where: {
        userId_questionUnitId: {
          userId: params.userId,
          questionUnitId: params.questionUnitId,
        },
      },
      create: {
        userId: params.userId,
        moduleId: params.moduleId,
        moduleUnitId: params.moduleUnitId,
        questionUnitId: params.questionUnitId,
        fsrsState: seed.state,
        fsrsDifficulty: seed.difficulty,
        fsrsStability: seed.stability,
        fsrsDueAt: seed.dueAt,
        fsrsLastReviewedAt: params.reviewedAt,
        reviewCount: seed.reps,
        lapseCount: seed.lapses,
        lastGrade: grade,
        lastSeenAt: params.reviewedAt,
        lastCorrectAt: params.reviewedAt,
        recentAvgTimeMs,
        firstSeenAt: params.reviewedAt,
        algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
      },
      update: {
        moduleId: params.moduleId,
        moduleUnitId: params.moduleUnitId,
        fsrsState: seed.state,
        fsrsDifficulty: seed.difficulty,
        fsrsStability: seed.stability,
        fsrsDueAt: seed.dueAt,
        fsrsLastReviewedAt: params.reviewedAt,
        reviewCount: seed.reps,
        lapseCount: seed.lapses,
        lastGrade: grade,
        lastSeenAt: params.reviewedAt,
        lastCorrectAt: params.reviewedAt,
        recentAvgTimeMs,
        firstSeenAt: params.reviewedAt,
        algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
      },
      select: this.stateSelect(),
    });
  }

  private async persistUpdate(
    prismaClient: PrismaClientLike,
    params: ApplyDailyPracticeEncounterParams,
    grade: ReturnType<DailyPracticeFsrsGradeService['mapEncounterToGrade']>,
    next: PolicyCardUpdate,
    existingState: StudentQuestionStateRecord,
  ): Promise<StudentQuestionStateRecord> {
    const recentAvgTimeMs = this.updateRecentAverageTimeMs(
      existingState.recentAvgTimeMs ?? null,
      params.timeTakenMs,
    );

    return prismaClient.studentQuestionState.upsert({
      where: {
        userId_questionUnitId: {
          userId: params.userId,
          questionUnitId: params.questionUnitId,
        },
      },
      create: {
        userId: params.userId,
        moduleId: params.moduleId,
        moduleUnitId: params.moduleUnitId,
        questionUnitId: params.questionUnitId,
        fsrsState: next.state,
        fsrsDifficulty: next.difficulty,
        fsrsStability: next.stability,
        fsrsDueAt: next.dueAt,
        fsrsLastReviewedAt: params.reviewedAt,
        reviewCount: next.reps,
        lapseCount: next.lapses,
        lastGrade: grade,
        lastSeenAt: params.reviewedAt,
        lastCorrectAt: params.firstAttemptCorrect ? params.reviewedAt : null,
        recentAvgTimeMs,
        firstSeenAt: params.reviewedAt,
        algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
      },
      update: {
        moduleId: params.moduleId,
        moduleUnitId: params.moduleUnitId,
        fsrsState: next.state,
        fsrsDifficulty: next.difficulty,
        fsrsStability: next.stability,
        fsrsDueAt: next.dueAt,
        fsrsLastReviewedAt: params.reviewedAt,
        reviewCount: next.reps,
        lapseCount: next.lapses,
        lastGrade: grade,
        lastSeenAt: params.reviewedAt,
        // Preserve the learner's most recent correct timestamp across incorrect reviews.
        lastCorrectAt: params.firstAttemptCorrect
          ? params.reviewedAt
          : (existingState.lastCorrectAt ?? null),
        recentAvgTimeMs,
        // Keep the original first-seen timestamp stable for later "new vs seen" product rules.
        firstSeenAt: existingState.firstSeenAt ?? params.reviewedAt,
        algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
      },
      select: this.stateSelect(),
    });
  }

  private async loadAcquisitionEvidence(
    prismaClient: PrismaClientLike,
    userId: number,
    questionUnitId: number,
  ): Promise<AcquisitionEvidence> {
    // The current attempt is persisted before this service runs, so walking attempts in order covers up to and including the first correct one.
    const attempts = await prismaClient.questionAttempt.findMany({
      where: {
        studentId: userId,
        questionId: questionUnitId,
      },
      orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
      select: {
        isCorrect: true,
        hintsUsed: true,
        timeTakenMs: true,
      },
    });

    let priorFailedAttempts = 0;
    let priorHintedAttempts = 0;
    let timeToFirstCorrectMs = 0;

    for (const attempt of attempts) {
      timeToFirstCorrectMs += attempt.timeTakenMs ?? 0;
      if (attempt.isCorrect) {
        break;
      }
      priorFailedAttempts += 1;
      if (attempt.hintsUsed > 0) {
        priorHintedAttempts += 1;
      }
    }

    return {
      priorFailedAttempts,
      priorHintedAttempts,
      timeToFirstCorrectMs,
    };
  }

  private stateSelect() {
    return {
      id: true,
      userId: true,
      moduleId: true,
      moduleUnitId: true,
      questionUnitId: true,
      fsrsState: true,
      fsrsDifficulty: true,
      fsrsStability: true,
      fsrsDueAt: true,
      fsrsLastReviewedAt: true,
      reviewCount: true,
      lapseCount: true,
      lastGrade: true,
      lastSeenAt: true,
      lastCorrectAt: true,
      recentAvgTimeMs: true,
      firstSeenAt: true,
      algorithmVersion: true,
    } as const;
  }

  private updateRecentAverageTimeMs(
    previousAverageMs: number | null,
    currentAttemptTimeMs: number,
  ): number {
    if (previousAverageMs === null) {
      return currentAttemptTimeMs;
    }

    // Light smoothing keeps the selector's speed signal stable while still adapting to recent behavior.
    return Math.round(previousAverageMs * 0.7 + currentAttemptTimeMs * 0.3);
  }
}
