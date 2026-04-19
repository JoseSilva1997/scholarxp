// Role: verifies the daily-practice selector applies dynamic sizing and no-set guards deterministically.
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DailyPracticeSelectionBucketValues,
  FsrsReviewGradeValues,
} from '@scholarxp/api-contracts';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import type {
  DailyPracticeCandidateQuestionRecord,
  StudentQuestionStateRecord,
} from './daily-practice.types';

describe('DailyPracticeSetSelectorService', () => {
  let service: DailyPracticeSetSelectorService;
  let candidateReadService: {
    listModuleCandidateQuestions: jest.Mock;
  };
  let questionStateReadService: {
    listStatesForModule: jest.Mock;
  };

  beforeEach(async () => {
    candidateReadService = {
      listModuleCandidateQuestions: jest.fn(),
    };
    questionStateReadService = {
      listStatesForModule: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeSetSelectorService,
        {
          provide: DailyPracticeCandidateReadService,
          useValue: candidateReadService,
        },
        {
          provide: DailyPracticeQuestionStateReadService,
          useValue: questionStateReadService,
        },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeSetSelectorService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('derives a three-question review-first plan from light review burden', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(201, 2, 1),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, {
        fsrsDueAt: new Date('2026-03-15T12:00:00.000Z'),
      }),
      buildState(102, 1, {
        fsrsDueAt: new Date('2026-03-16T12:00:00.000Z'),
      }),
      buildState(201, 2, {
        fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.hard,
        lastSeenAt: new Date('2026-03-16T12:00:00.000Z'),
      }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(result.plan).toEqual({
      targetQuestionCount: 3,
      dueReviewQuota: 2,
      reinforcementQuota: 1,
    });
    expect(result.selectedQuestions).toHaveLength(3);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(2);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(1);
  });

  it('returns no set when fewer than three attempted questions exist', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(201, 2, 1),
      buildCandidate(202, 2, 2),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, {
        fsrsDueAt: new Date('2026-03-16T12:00:00.000Z'),
      }),
      buildState(201, 2, {
        fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
      }),
      // Q202 has no state row → never attempted, not eligible for the review-only set.
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(result.plan).toEqual({
      targetQuestionCount: 0,
      dueReviewQuota: 0,
      reinforcementQuota: 0,
    });
    expect(result.selectedQuestions).toEqual([]);
  });

  // --- Reinforcement bucket classification ---
  // Each test below isolates one specific FSRS condition so a regression in the classifier
  // is immediately pinpointed rather than hidden inside a larger integration scenario.

  it('classifies a not-yet-due question as reinforcement when last grade was again', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // 'again' grade + future due + recent lastSeenAt → reinforcement candidate.
      buildState(103, 1, {
        fsrsDueAt: new Date('2026-03-25T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.again,
        lastSeenAt: new Date('2026-03-16T12:00:00.000Z'),
        lapseCount: 0,
      }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    const reinforcementSelections = result.selectedQuestions.filter(
      (question) =>
        question.sourceBucket ===
        DailyPracticeSelectionBucketValues.reinforcement,
    );
    expect(reinforcementSelections).toHaveLength(1);
    expect(reinforcementSelections[0].questionUnitId).toBe(103);
  });

  it('excludes a not-yet-due question from reinforcement when last grade was good even if lapse count is positive', async () => {
    // Q103 (good grade + positive lapse count) must NOT enter reinforcement —
    // lapse history alone no longer qualifies. Inventory needs a third due-review
    // question so the set hits the minimum floor of 3 without new-sequence backfill.
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // Good grade + positive lapse count → recovered, no longer a reinforcement candidate.
      buildState(103, 1, { lapseCount: 1 }),
      buildState(104, 1, { fsrsDueAt: new Date('2026-03-16T13:00:00.000Z') }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(0);
    expect(
      result.selectedQuestions.some(
        (question) => question.questionUnitId === 103,
      ),
    ).toBe(false);
  });

  it('excludes a not-yet-due question from reinforcement when last grade was good and lapse count is zero', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // Good grade, no lapses, future due → falls into no bucket.
      buildState(103, 1),
      buildState(104, 1, { fsrsDueAt: new Date('2026-03-16T13:00:00.000Z') }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(
      result.selectedQuestions.some(
        (question) => question.questionUnitId === 103,
      ),
    ).toBe(false);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(0);
  });

  it('excludes a reinforcement candidate seen more than fourteen days ago', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // 'again' grade but last seen 15 days ago — outside the 14-day struggle window.
      buildState(103, 1, {
        lastGrade: FsrsReviewGradeValues.again,
        lastSeenAt: new Date('2026-03-02T12:00:00.000Z'),
      }),
      buildState(104, 1, { fsrsDueAt: new Date('2026-03-16T13:00:00.000Z') }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(
      result.selectedQuestions.some(
        (question) => question.questionUnitId === 103,
      ),
    ).toBe(false);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(0);
  });

  it('includes a reinforcement candidate whose last-seen timestamp is exactly fourteen days ago', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    const exactlyFourteenDaysAgo = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000,
    );
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // Exactly at the 14-day inclusive boundary → must be classified as reinforcement.
      buildState(103, 1, {
        lastGrade: FsrsReviewGradeValues.again,
        lastSeenAt: exactlyFourteenDaysAgo,
      }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    const reinforcementSelections = result.selectedQuestions.filter(
      (q) =>
        q.sourceBucket === DailyPracticeSelectionBucketValues.reinforcement,
    );
    expect(reinforcementSelections).toHaveLength(1);
    expect(reinforcementSelections[0].questionUnitId).toBe(103);
  });

  it('excludes a reinforcement candidate whose last-seen timestamp is fourteen days and one millisecond ago', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    const oneMillisecondPastWindow = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000 - 1,
    );
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // 1 ms past the window → must be excluded despite 'again' grade.
      buildState(103, 1, {
        lastGrade: FsrsReviewGradeValues.again,
        lastSeenAt: oneMillisecondPastWindow,
      }),
      buildState(104, 1, { fsrsDueAt: new Date('2026-03-16T13:00:00.000Z') }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(result.selectedQuestions.some((q) => q.questionUnitId === 103)).toBe(
      false,
    );
    expect(
      result.selectedQuestions.filter(
        (q) =>
          q.sourceBucket === DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(0);
  });

  it('caps selections at two questions per lesson when alternatives exist', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(201, 2, 1),
      buildCandidate(202, 2, 2),
      buildCandidate(301, 3, 1),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-13T12:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-14T12:00:00.000Z') }),
      buildState(103, 1, { fsrsDueAt: new Date('2026-03-15T12:00:00.000Z') }),
      buildState(201, 2, { fsrsDueAt: new Date('2026-03-16T12:00:00.000Z') }),
      buildState(202, 2, { fsrsDueAt: new Date('2026-03-12T12:00:00.000Z') }),
      buildState(301, 3, {
        fsrsDueAt: new Date('2026-03-25T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.hard,
        lastSeenAt: new Date('2026-03-16T12:00:00.000Z'),
      }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
      targetQuestionCount: 5,
    });

    const lessonOneSelections = result.selectedQuestions.filter(
      (question) => question.moduleUnitId === 1,
    );

    expect(result.plan.targetQuestionCount).toBe(5);
    expect(lessonOneSelections).toHaveLength(2);
    expect(result.selectedQuestions).toHaveLength(5);
  });
});

function buildCandidate(
  questionUnitId: number,
  moduleUnitId: number,
  questionOrder: number,
): DailyPracticeCandidateQuestionRecord {
  return {
    moduleUnitId,
    moduleUnitTitle: `Lesson ${moduleUnitId}`,
    moduleUnitSortOrder: moduleUnitId,
    questionUnitId,
    questionUnitTitle: `Question ${questionUnitId}`,
    questionGroupId: moduleUnitId * 10,
    questionGroupSortOrder: questionOrder,
    coreContentId: questionUnitId * 10,
    questionType: 'multiple_choice',
    questionDifficultyScore: 0.5,
  };
}

function buildState(
  questionUnitId: number,
  moduleUnitId: number,
  overrides?: Partial<StudentQuestionStateRecord>,
): StudentQuestionStateRecord {
  return {
    id: `state-${questionUnitId}`,
    userId: 42,
    moduleId: 7,
    moduleUnitId,
    questionUnitId,
    fsrsState: 'review',
    fsrsDifficulty: 5,
    fsrsStability: 2,
    fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
    fsrsLastReviewedAt: new Date('2026-03-16T12:00:00.000Z'),
    reviewCount: 2,
    lapseCount: 0,
    lastGrade: FsrsReviewGradeValues.good,
    lastSeenAt: new Date('2026-03-16T12:00:00.000Z'),
    lastCorrectAt: new Date('2026-03-16T12:00:00.000Z'),
    recentAvgTimeMs: 8000,
    firstSeenAt: new Date('2026-03-10T12:00:00.000Z'),
    algorithmVersion: 'fsrs_v1',
    ...overrides,
  };
}
