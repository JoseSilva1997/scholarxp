// Role: assembles module-scoped daily-practice candidates into bucketed selections so adaptive policy stays deterministic and unit-testable.
import { Injectable } from '@nestjs/common';
import {
  DailyPracticeSelectionBucketValues,
  FsrsReviewGradeValues,
} from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import { buildDailyPracticeSelectionPlan } from './daily-practice-set-sizing.policy';
import type {
  DailyPracticeCandidateQuestionRecord,
  DailyPracticeSelectionInventory,
  DailyPracticeSelectionResult,
  SelectedDailyPracticeQuestionRecord,
  StudentQuestionStateRecord,
} from './daily-practice.types';

const MAX_QUESTIONS_PER_LESSON = 3;
const RECENT_STRUGGLE_WINDOW_DAYS = 14;

type BuildDailyPracticeSelectionParams = {
  userId: number;
  moduleId: number;
  now: Date;
  targetQuestionCount?: number;
};

type EnrichedCandidate = {
  candidate: DailyPracticeCandidateQuestionRecord;
  studentQuestionState: StudentQuestionStateRecord | null;
};

type CandidateWithSelectionMetadata = {
  candidate: DailyPracticeCandidateQuestionRecord;
  studentQuestionState: StudentQuestionStateRecord | null;
  selectionScore: number;
  selectionReason: string;
};

@Injectable()
export class DailyPracticeSetSelectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly candidateReadService: DailyPracticeCandidateReadService,
    private readonly questionStateReadService: DailyPracticeQuestionStateReadService,
  ) {}

  // Selection is kept deterministic so later persistence and interleaving steps can build on stable candidate buckets.
  async selectQuestions(
    params: BuildDailyPracticeSelectionParams,
  ): Promise<DailyPracticeSelectionResult> {
    const [candidates, states, completedModuleUnitIds] = await Promise.all([
      this.candidateReadService.listModuleCandidateQuestions(params.moduleId),
      this.questionStateReadService.listStatesForModule(
        params.userId,
        params.moduleId,
      ),
      this.loadCompletedModuleUnitIds(params.userId, params.moduleId),
    ]);

    const stateByQuestionId = new Map(
      states.map((state) => [state.questionUnitId, state]),
    );
    // Daily practice only surfaces questions from fully-mastered units so the student
    // reinforces material they've already proven before being asked to review it daily.
    const enrichedCandidates = candidates
      .filter((candidate) => completedModuleUnitIds.has(candidate.moduleUnitId))
      .map((candidate) => ({
        candidate,
        studentQuestionState:
          stateByQuestionId.get(candidate.questionUnitId) ?? null,
      }));
    const dueReviewCandidates = this.buildDueReviewCandidates(
      enrichedCandidates,
      params.now,
    );
    const reinforcementCandidates = this.buildReinforcementCandidates(
      enrichedCandidates,
      params.now,
    );
    const selectionPlan = buildDailyPracticeSelectionPlan(
      this.buildSelectionInventory({
        dueReviewCandidates,
        reinforcementCandidates,
      }),
      params.targetQuestionCount,
    );

    if (selectionPlan.targetQuestionCount === 0) {
      return {
        plan: selectionPlan,
        selectedQuestions: [],
      };
    }

    const selectedQuestionIds = new Set<number>();
    const lessonCounts = new Map<number, number>();

    const dueReviewSelections = this.selectFromBucket({
      bucketCandidates: dueReviewCandidates,
      count: selectionPlan.dueReviewQuota,
      sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
      selectedQuestionIds,
      lessonCounts,
    });

    const reinforcementSelections = this.selectFromBucket({
      bucketCandidates: reinforcementCandidates,
      count: selectionPlan.reinforcementQuota,
      sourceBucket: DailyPracticeSelectionBucketValues.reinforcement,
      selectedQuestionIds,
      lessonCounts,
    });

    const selectedQuestions = [
      ...dueReviewSelections,
      ...reinforcementSelections,
    ];

    const dueReviewShortfall =
      selectionPlan.dueReviewQuota - dueReviewSelections.length;
    if (dueReviewShortfall > 0) {
      selectedQuestions.push(
        ...this.fillFromBuckets(
          [
            {
              sourceBucket: DailyPracticeSelectionBucketValues.reinforcement,
              bucketCandidates: reinforcementCandidates,
            },
          ],
          dueReviewShortfall,
          selectedQuestionIds,
          lessonCounts,
        ),
      );
    }

    const remainingCount =
      selectionPlan.targetQuestionCount - selectedQuestions.length;
    if (remainingCount > 0) {
      selectedQuestions.push(
        ...this.fillFromBuckets(
          [
            {
              sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
              bucketCandidates: dueReviewCandidates,
            },
            {
              sourceBucket: DailyPracticeSelectionBucketValues.reinforcement,
              bucketCandidates: reinforcementCandidates,
            },
          ],
          remainingCount,
          selectedQuestionIds,
          lessonCounts,
        ),
      );
    }

    return {
      plan: selectionPlan,
      selectedQuestions,
    };
  }

  private buildSelectionInventory(input: {
    dueReviewCandidates: CandidateWithSelectionMetadata[];
    reinforcementCandidates: CandidateWithSelectionMetadata[];
  }): DailyPracticeSelectionInventory {
    return {
      dueReviewCount: input.dueReviewCandidates.length,
      reinforcementCount: input.reinforcementCandidates.length,
    };
  }

  private buildDueReviewCandidates(
    candidates: EnrichedCandidate[],
    now: Date,
  ): CandidateWithSelectionMetadata[] {
    return candidates
      .filter(
        ({ studentQuestionState }) =>
          studentQuestionState !== null &&
          studentQuestionState.fsrsDueAt.getTime() <= now.getTime(),
      )
      .map(({ candidate, studentQuestionState }) => {
        const persistedState = this.requireStudentQuestionState(
          studentQuestionState,
          'Due-review candidates must have persisted student question state.',
        );
        const overdueMs = now.getTime() - persistedState.fsrsDueAt.getTime();

        return {
          candidate,
          studentQuestionState: persistedState,
          selectionScore: overdueMs,
          selectionReason: `Question is overdue for review by ${Math.floor(
            overdueMs / (60 * 60 * 1000),
          )} hours.`,
        };
      })
      .sort((left, right) => {
        return (
          right.selectionScore - left.selectionScore ||
          left.candidate.moduleUnitSortOrder -
            right.candidate.moduleUnitSortOrder ||
          this.compareNullableNumbers(
            left.candidate.questionGroupSortOrder,
            right.candidate.questionGroupSortOrder,
          ) ||
          left.candidate.questionUnitId - right.candidate.questionUnitId
        );
      });
  }

  private buildReinforcementCandidates(
    candidates: EnrichedCandidate[],
    now: Date,
  ): CandidateWithSelectionMetadata[] {
    return candidates
      .filter(({ studentQuestionState }) => {
        if (!studentQuestionState) {
          return false;
        }

        if (studentQuestionState.fsrsDueAt.getTime() <= now.getTime()) {
          return false;
        }

        return this.isRecentStruggleCandidate(studentQuestionState, now);
      })
      .map(({ candidate, studentQuestionState }) => ({
        candidate,
        studentQuestionState: this.requireStudentQuestionState(
          studentQuestionState,
          'Reinforcement candidates must have persisted student question state.',
        ),
        selectionScore: this.calculateReinforcementScore(
          this.requireStudentQuestionState(
            studentQuestionState,
            'Reinforcement candidates must have persisted student question state.',
          ),
          now,
        ),
        selectionReason:
          'Question reinforces a recent struggle before it becomes formally due again.',
      }))
      .sort((left, right) => {
        return (
          right.selectionScore - left.selectionScore ||
          left.candidate.moduleUnitSortOrder -
            right.candidate.moduleUnitSortOrder ||
          this.compareNullableNumbers(
            left.candidate.questionGroupSortOrder,
            right.candidate.questionGroupSortOrder,
          ) ||
          left.candidate.questionUnitId - right.candidate.questionUnitId
        );
      });
  }

  private requireStudentQuestionState(
    studentQuestionState: StudentQuestionStateRecord | null,
    errorMessage: string,
  ): StudentQuestionStateRecord {
    if (!studentQuestionState) {
      throw new Error(errorMessage);
    }

    return studentQuestionState;
  }

  private isRecentStruggleCandidate(
    studentQuestionState: StudentQuestionStateRecord,
    now: Date,
  ): boolean {
    const lastSeenAt = studentQuestionState.lastSeenAt;
    if (!lastSeenAt) {
      return false;
    }

    const isWithinRecentWindow =
      now.getTime() - lastSeenAt.getTime() <=
      RECENT_STRUGGLE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    // Lapse history is intentionally excluded — FSRS already schedules lapsed questions
    // more aggressively via shorter intervals. Reinforcement should only boost questions
    // that are currently struggling, not ones that have since recovered.
    return (
      isWithinRecentWindow &&
      (studentQuestionState.lastGrade === FsrsReviewGradeValues.again ||
        studentQuestionState.lastGrade === FsrsReviewGradeValues.hard)
    );
  }

  private calculateReinforcementScore(
    studentQuestionState: StudentQuestionStateRecord,
    now: Date,
  ): number {
    const recencyMs = studentQuestionState.lastSeenAt
      ? now.getTime() - studentQuestionState.lastSeenAt.getTime()
      : Number.MAX_SAFE_INTEGER;
    const gradePenalty =
      studentQuestionState.lastGrade === FsrsReviewGradeValues.again
        ? 3
        : studentQuestionState.lastGrade === FsrsReviewGradeValues.hard
          ? 2
          : 1;
    const recencyScore = Math.max(
      0,
      RECENT_STRUGGLE_WINDOW_DAYS * 24 * 60 * 60 * 1000 - recencyMs,
    );

    return (
      gradePenalty * 1_000_000_000 +
      studentQuestionState.lapseCount * 1_000_000 +
      recencyScore
    );
  }

  private selectFromBucket(input: {
    bucketCandidates: CandidateWithSelectionMetadata[];
    count: number;
    sourceBucket: SelectedDailyPracticeQuestionRecord['sourceBucket'];
    selectedQuestionIds: Set<number>;
    lessonCounts: Map<number, number>;
  }): SelectedDailyPracticeQuestionRecord[] {
    const selected = this.takeCandidatesWithLessonCap(
      input.bucketCandidates,
      input.count,
      input.selectedQuestionIds,
      input.lessonCounts,
    );

    return selected.map(
      ({
        candidate,
        studentQuestionState,
        selectionScore,
        selectionReason,
      }) => ({
        ...candidate,
        sourceBucket: input.sourceBucket,
        selectionScore,
        selectionReason,
        studentQuestionState,
      }),
    );
  }

  private fillFromBuckets(
    buckets: Array<{
      sourceBucket: SelectedDailyPracticeQuestionRecord['sourceBucket'];
      bucketCandidates: CandidateWithSelectionMetadata[];
    }>,
    remainingCount: number,
    selectedQuestionIds: Set<number>,
    lessonCounts: Map<number, number>,
  ): SelectedDailyPracticeQuestionRecord[] {
    const selected: SelectedDailyPracticeQuestionRecord[] = [];

    for (const bucket of buckets) {
      if (selected.length >= remainingCount) {
        break;
      }

      selected.push(
        ...this.selectFromBucket({
          bucketCandidates: bucket.bucketCandidates,
          count: remainingCount - selected.length,
          sourceBucket: bucket.sourceBucket,
          selectedQuestionIds,
          lessonCounts,
        }),
      );
    }

    return selected;
  }

  private takeCandidatesWithLessonCap(
    candidates: CandidateWithSelectionMetadata[],
    count: number,
    selectedQuestionIds: Set<number>,
    lessonCounts: Map<number, number>,
  ): CandidateWithSelectionMetadata[] {
    const selected: CandidateWithSelectionMetadata[] = [];

    for (const candidate of candidates) {
      if (selected.length >= count) {
        break;
      }

      if (selectedQuestionIds.has(candidate.candidate.questionUnitId)) {
        continue;
      }

      const currentLessonCount =
        lessonCounts.get(candidate.candidate.moduleUnitId) ?? 0;
      if (currentLessonCount >= MAX_QUESTIONS_PER_LESSON) {
        continue;
      }

      this.acceptCandidate(
        candidate,
        selected,
        selectedQuestionIds,
        lessonCounts,
      );
    }

    // Relax the cap when the module is too small; completeness is more important than artificial variety in those cases.
    for (const candidate of candidates) {
      if (selected.length >= count) {
        break;
      }

      if (selectedQuestionIds.has(candidate.candidate.questionUnitId)) {
        continue;
      }

      this.acceptCandidate(
        candidate,
        selected,
        selectedQuestionIds,
        lessonCounts,
      );
    }

    return selected;
  }

  private acceptCandidate(
    candidate: CandidateWithSelectionMetadata,
    selected: CandidateWithSelectionMetadata[],
    selectedQuestionIds: Set<number>,
    lessonCounts: Map<number, number>,
  ): void {
    selected.push(candidate);
    selectedQuestionIds.add(candidate.candidate.questionUnitId);
    lessonCounts.set(
      candidate.candidate.moduleUnitId,
      (lessonCounts.get(candidate.candidate.moduleUnitId) ?? 0) + 1,
    );
  }

  // Completion is the hard eligibility gate for daily practice: questions from partially-mastered units never reach the set.
  private async loadCompletedModuleUnitIds(
    userId: number,
    moduleId: number,
  ): Promise<Set<number>> {
    const progressRows = await this.prisma.moduleUnitUserProgress.findMany({
      where: {
        studentId: userId,
        isCompleted: true,
        moduleUnit: {
          moduleId,
        },
      },
      select: {
        moduleUnitId: true,
      },
    });

    return new Set(progressRows.map((row) => row.moduleUnitId));
  }

  private compareNullableNumbers(
    left: number | null,
    right: number | null,
  ): number {
    const normalizedLeft = left ?? Number.MAX_SAFE_INTEGER;
    const normalizedRight = right ?? Number.MAX_SAFE_INTEGER;

    return normalizedLeft - normalizedRight;
  }
}
