// Role: assembles module-scoped daily-practice candidates into bucketed selections so adaptive policy stays deterministic and unit-testable.
import { Injectable } from '@nestjs/common';
import {
  DailyPracticeSelectionBucketValues,
  FsrsReviewGradeValues,
} from '@scholarxp/api-contracts';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import type {
  DailyPracticeCandidateQuestionRecord,
  DailyPracticeSelectionPlan,
  DailyPracticeSelectionResult,
  SelectedDailyPracticeQuestionRecord,
  StudentQuestionStateRecord,
} from './daily-practice.types';

const DEFAULT_TARGET_QUESTION_COUNT = 7;
const MIN_TARGET_QUESTION_COUNT = 5;
const MAX_TARGET_QUESTION_COUNT = 10;
const MAX_QUESTIONS_PER_LESSON = 2;
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
    private readonly candidateReadService: DailyPracticeCandidateReadService,
    private readonly questionStateReadService: DailyPracticeQuestionStateReadService,
  ) {}

  // Selection is kept deterministic so later persistence and interleaving steps can build on stable candidate buckets.
  async selectQuestions(
    params: BuildDailyPracticeSelectionParams,
  ): Promise<DailyPracticeSelectionResult> {
    const [candidates, states] = await Promise.all([
      this.candidateReadService.listModuleCandidateQuestions(params.moduleId),
      this.questionStateReadService.listStatesForModule(
        params.userId,
        params.moduleId,
      ),
    ]);

    const selectionPlan = this.buildSelectionPlan(params.targetQuestionCount);
    const stateByQuestionId = new Map(
      states.map((state) => [state.questionUnitId, state]),
    );
    const enrichedCandidates = candidates.map((candidate) => ({
      candidate,
      studentQuestionState:
        stateByQuestionId.get(candidate.questionUnitId) ?? null,
    }));

    const selectedQuestionIds = new Set<number>();
    const lessonCounts = new Map<number, number>();

    const dueReviewSelections = this.selectFromBucket({
      bucketCandidates: this.buildDueReviewCandidates(
        enrichedCandidates,
        params.now,
      ),
      count: selectionPlan.dueReviewQuota,
      sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
      selectedQuestionIds,
      lessonCounts,
    });

    const newSequenceSelections = this.selectFromBucket({
      bucketCandidates: this.buildNewSequenceCandidates(enrichedCandidates),
      count: selectionPlan.newSequenceQuota,
      sourceBucket: DailyPracticeSelectionBucketValues.newSequence,
      selectedQuestionIds,
      lessonCounts,
    });

    const reinforcementSelections = this.selectFromBucket({
      bucketCandidates: this.buildReinforcementCandidates(
        enrichedCandidates,
        params.now,
      ),
      count: selectionPlan.reinforcementQuota,
      sourceBucket: DailyPracticeSelectionBucketValues.reinforcement,
      selectedQuestionIds,
      lessonCounts,
    });

    const selectedQuestions = [
      ...dueReviewSelections,
      ...newSequenceSelections,
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
              bucketCandidates: this.buildReinforcementCandidates(
                enrichedCandidates,
                params.now,
              ),
            },
            {
              sourceBucket: DailyPracticeSelectionBucketValues.newSequence,
              bucketCandidates:
                this.buildNewSequenceCandidates(enrichedCandidates),
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
              bucketCandidates: this.buildDueReviewCandidates(
                enrichedCandidates,
                params.now,
              ),
            },
            {
              sourceBucket: DailyPracticeSelectionBucketValues.reinforcement,
              bucketCandidates: this.buildReinforcementCandidates(
                enrichedCandidates,
                params.now,
              ),
            },
            {
              sourceBucket: DailyPracticeSelectionBucketValues.newSequence,
              bucketCandidates:
                this.buildNewSequenceCandidates(enrichedCandidates),
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

  private buildSelectionPlan(
    requestedTargetQuestionCount?: number,
  ): DailyPracticeSelectionPlan {
    const targetQuestionCount = this.clampTargetQuestionCount(
      requestedTargetQuestionCount ?? DEFAULT_TARGET_QUESTION_COUNT,
    );
    const dueReviewQuota = Math.min(
      targetQuestionCount,
      Math.max(1, Math.round(targetQuestionCount * 0.57)),
    );
    const newSequenceQuota = Math.min(
      Math.max(1, targetQuestionCount - dueReviewQuota),
      Math.max(1, Math.round(targetQuestionCount * 0.29)),
    );
    const reinforcementQuota = Math.max(
      0,
      targetQuestionCount - dueReviewQuota - newSequenceQuota,
    );

    return {
      targetQuestionCount,
      dueReviewQuota,
      newSequenceQuota,
      reinforcementQuota,
    };
  }

  private clampTargetQuestionCount(targetQuestionCount: number): number {
    return Math.min(
      MAX_TARGET_QUESTION_COUNT,
      Math.max(MIN_TARGET_QUESTION_COUNT, targetQuestionCount),
    );
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

  private buildNewSequenceCandidates(
    candidates: EnrichedCandidate[],
  ): CandidateWithSelectionMetadata[] {
    const unseenCandidates = candidates.filter(
      ({ studentQuestionState }) => studentQuestionState === null,
    );
    if (unseenCandidates.length === 0) {
      return [];
    }

    const earliestModuleUnitSortOrder = unseenCandidates.reduce(
      (smallest, current) =>
        Math.min(smallest, current.candidate.moduleUnitSortOrder),
      Number.POSITIVE_INFINITY,
    );

    return unseenCandidates
      .filter(
        ({ candidate }) =>
          candidate.moduleUnitSortOrder === earliestModuleUnitSortOrder,
      )
      .sort((left, right) => {
        return (
          left.candidate.moduleUnitSortOrder -
            right.candidate.moduleUnitSortOrder ||
          this.compareNullableNumbers(
            left.candidate.questionGroupSortOrder,
            right.candidate.questionGroupSortOrder,
          ) ||
          left.candidate.questionUnitId - right.candidate.questionUnitId
        );
      })
      .map(({ candidate, studentQuestionState }, index) => ({
        candidate,
        studentQuestionState,
        // Lower sort-order questions should remain more attractive, so invert the index into a descending score.
        selectionScore: unseenCandidates.length - index,
        selectionReason:
          'Question introduces the earliest live lesson content the student has not seen yet.',
      }));
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

    return (
      isWithinRecentWindow &&
      (studentQuestionState.lastGrade === FsrsReviewGradeValues.again ||
        studentQuestionState.lastGrade === FsrsReviewGradeValues.hard ||
        studentQuestionState.lapseCount > 0)
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

  private compareNullableNumbers(
    left: number | null,
    right: number | null,
  ): number {
    const normalizedLeft = left ?? Number.MAX_SAFE_INTEGER;
    const normalizedRight = right ?? Number.MAX_SAFE_INTEGER;

    return normalizedLeft - normalizedRight;
  }
}
