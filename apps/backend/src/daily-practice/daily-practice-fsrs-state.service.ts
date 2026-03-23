// Role: applies FSRS review updates to persisted student-question state from one normalized daily-practice encounter.
import { Injectable } from '@nestjs/common';
import {
  DailyPracticeAlgorithmVersionValues,
  FsrsCardStateValues,
  type FsrsCardState,
} from '@scholarxp/api-contracts';
import { createEmptyCard, fsrs, State, type Card } from 'ts-fsrs';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
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
};

type DailyPracticeV1FsrsGrade = ReturnType<
  DailyPracticeFsrsGradeService['mapEncounterToGrade']
>;

@Injectable()
export class DailyPracticeFsrsStateService {
  private readonly scheduler = fsrs();

  constructor(
    private readonly prisma: PrismaService,
    private readonly questionStateReadService: DailyPracticeQuestionStateReadService,
    private readonly fsrsGradeService: DailyPracticeFsrsGradeService,
  ) {}

  // One normalized encounter becomes one FSRS review update so retries within the same episode do not distort memory scheduling.
  async applyEncounter(
    params: ApplyDailyPracticeEncounterParams,
    tx?: PrismaClientLike,
  ): Promise<StudentQuestionStateRecord> {
    const prismaClient = tx ?? this.prisma;
    const existingState =
      await this.questionStateReadService.findStateForQuestion(
        params.userId,
        params.questionUnitId,
        prismaClient,
      );
    const grade = this.fsrsGradeService.mapEncounterToGrade({
      firstAttemptCorrect: params.firstAttemptCorrect,
      hintUnlocked: params.hintUnlocked,
    });
    const nextCard = this.computeNextCard(
      existingState,
      grade,
      params.reviewedAt,
    );
    const recentAvgTimeMs = this.updateRecentAverageTimeMs(
      existingState?.recentAvgTimeMs ?? null,
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
        fsrsState: this.toPersistedState(nextCard.state),
        fsrsDifficulty: nextCard.difficulty,
        fsrsStability: nextCard.stability,
        fsrsDueAt: nextCard.due,
        fsrsLastReviewedAt: params.reviewedAt,
        reviewCount: nextCard.reps,
        lapseCount: nextCard.lapses,
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
        fsrsState: this.toPersistedState(nextCard.state),
        fsrsDifficulty: nextCard.difficulty,
        fsrsStability: nextCard.stability,
        fsrsDueAt: nextCard.due,
        fsrsLastReviewedAt: params.reviewedAt,
        reviewCount: nextCard.reps,
        lapseCount: nextCard.lapses,
        lastGrade: grade,
        lastSeenAt: params.reviewedAt,
        // Preserve the learner's most recent correct timestamp across incorrect reviews.
        lastCorrectAt: params.firstAttemptCorrect
          ? params.reviewedAt
          : (existingState?.lastCorrectAt ?? null),
        recentAvgTimeMs,
        // Keep the original first-seen timestamp stable for later "new vs seen" product rules.
        firstSeenAt: existingState?.firstSeenAt ?? params.reviewedAt,
        algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
      },
      select: {
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
      },
    });
  }

  private computeNextCard(
    existingState: StudentQuestionStateRecord | null,
    grade: DailyPracticeV1FsrsGrade,
    reviewedAt: Date,
  ): Card {
    const currentCard = existingState
      ? this.toFsrsCard(existingState)
      : createEmptyCard(reviewedAt);
    // Use the single-grade API so the ts-fsrs return value stays explicitly typed for lint-safe persistence updates.
    return this.scheduler.next(
      currentCard,
      reviewedAt,
      this.fsrsGradeService.toFsrsRating(grade),
      (recordLog) => recordLog.card,
    );
  }

  private toFsrsCard(state: StudentQuestionStateRecord): Card {
    return {
      due: state.fsrsDueAt,
      stability: state.fsrsStability,
      difficulty: state.fsrsDifficulty,
      // The persisted state intentionally stores long-lived FSRS fields only; daily practice does not yet rely on replaying same-day micro steps.
      elapsed_days: 0,
      scheduled_days: this.calculateScheduledDays(state),
      learning_steps: 0,
      reps: state.reviewCount,
      lapses: state.lapseCount,
      state: this.toRuntimeState(state.fsrsState),
      last_review: state.fsrsLastReviewedAt ?? undefined,
    };
  }

  private calculateScheduledDays(state: StudentQuestionStateRecord): number {
    if (!state.fsrsLastReviewedAt) {
      return 0;
    }

    const dayDifference =
      (state.fsrsDueAt.getTime() - state.fsrsLastReviewedAt.getTime()) /
      (24 * 60 * 60 * 1000);

    return Math.max(0, Math.round(dayDifference));
  }

  private toPersistedState(state: State): FsrsCardState {
    if (state === State.Learning) {
      return FsrsCardStateValues.learning;
    }

    if (state === State.Review) {
      return FsrsCardStateValues.review;
    }

    if (state === State.Relearning) {
      return FsrsCardStateValues.relearning;
    }

    return FsrsCardStateValues.new;
  }

  private toRuntimeState(state: string): State {
    if (state === FsrsCardStateValues.learning) {
      return State.Learning;
    }

    if (state === FsrsCardStateValues.review) {
      return State.Review;
    }

    if (state === FsrsCardStateValues.relearning) {
      return State.Relearning;
    }

    return State.New;
  }

  private updateRecentAverageTimeMs(
    previousAverageMs: number | null,
    currentAttemptTimeMs: number,
  ): number {
    if (previousAverageMs === null) {
      return currentAttemptTimeMs;
    }

    // A light smoothing factor keeps the selector's speed signal stable while still adapting to recent behavior.
    return Math.round(previousAverageMs * 0.7 + currentAttemptTimeMs * 0.3);
  }
}
