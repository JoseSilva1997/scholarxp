// Role: verifies the daily-practice selector applies dynamic sizing, started-lesson progression, and no-set guards deterministically.
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DailyPracticeSelectionBucketValues,
  FsrsReviewGradeValues,
} from '@scholarxp/api-contracts';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';
import { DailyPracticeModuleProgressReadService } from './daily-practice-module-progress-read.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import type {
  DailyPracticeCandidateQuestionRecord,
  ModuleUnitProgressRecord,
  StudentQuestionStateRecord,
} from './daily-practice.types';

describe('DailyPracticeSetSelectorService', () => {
  let service: DailyPracticeSetSelectorService;
  let candidateReadService: {
    listModuleCandidateQuestions: jest.Mock;
  };
  let moduleProgressReadService: {
    listModuleUnitProgress: jest.Mock;
  };
  let questionStateReadService: {
    listStatesForModule: jest.Mock;
  };

  beforeEach(async () => {
    candidateReadService = {
      listModuleCandidateQuestions: jest.fn(),
    };
    moduleProgressReadService = {
      listModuleUnitProgress: jest.fn(),
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
          provide: DailyPracticeModuleProgressReadService,
          useValue: moduleProgressReadService,
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
      buildCandidate(301, 3, 1),
      buildCandidate(302, 3, 2),
      buildCandidate(303, 3, 3),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
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
      // A single seen question marks lesson 3 as started so its unseen questions can become new-sequence candidates.
      buildState(301, 3, {
        fsrsDueAt: new Date('2026-03-22T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
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
      newSequenceQuota: 0,
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
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(0);
  });

  it('backfills due shortfalls from new-sequence and excludes never-attempted lessons', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(201, 2, 1),
      buildCandidate(202, 2, 2),
      buildCandidate(203, 2, 3),
      buildCandidate(301, 3, 1),
      buildCandidate(302, 3, 2),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, {
        fsrsDueAt: new Date('2026-03-16T12:00:00.000Z'),
      }),
      // Lesson 2 is started but incomplete, so its unseen questions are eligible as new-sequence top-ups.
      buildState(201, 2, {
        fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
      }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(result.plan.targetQuestionCount).toBe(3);
    expect(result.selectedQuestions).toHaveLength(3);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(1);
    const newSequenceSelections = result.selectedQuestions.filter(
      (question) =>
        question.sourceBucket ===
        DailyPracticeSelectionBucketValues.newSequence,
    );
    expect(newSequenceSelections).toHaveLength(2);
    expect(
      newSequenceSelections.every((question) => question.moduleUnitId === 2),
    ).toBe(true);
  });

  it('returns no set when fewer than three eligible questions exist', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(201, 2, 1),
      buildCandidate(202, 2, 2),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, {
        fsrsDueAt: new Date('2026-03-16T12:00:00.000Z'),
      }),
      // Only one unseen question remains in a started lesson, so total eligible inventory is below the minimum floor.
      buildState(201, 2, {
        fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
      }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(result.plan).toEqual({
      targetQuestionCount: 0,
      dueReviewQuota: 0,
      newSequenceQuota: 0,
      reinforcementQuota: 0,
    });
    expect(result.selectedQuestions).toEqual([]);
  });

  // --- Reinforcement bucket classification ---
  // Each test below isolates one specific FSRS condition so a regression in the classifier
  // is immediately pinpointed rather than hidden inside a larger integration scenario.

  it('classifies a not-yet-due question as reinforcement when last grade was again', async () => {
    // Q101/Q102: due-review supply. Q103: future due, 'again' grade → reinforcement.
    // All three questions have state, so new-sequence count is zero.
    // Total inventory (2 due + 1 reinforcement) satisfies the minimum floor of 3.
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
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
    // Q103: future due, 'good' grade, lapseCount=1 → NOT reinforcement.
    // Lapse history alone no longer qualifies — FSRS already schedules the recovery via due-review.
    // Q104: unseen → new-sequence candidate to keep total inventory at the minimum of 3.
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // Good grade + positive lapse count → recovered, no longer a reinforcement candidate.
      buildState(103, 1, { lapseCount: 1 }),
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
  });

  it('excludes a not-yet-due question from reinforcement when last grade was good and lapse count is zero', async () => {
    // Q103: future due, 'good' grade, no lapses → not reinforcement, not due, contributes nothing.
    // Q104: unseen → new_sequence (backfill slot), which raises totalEligible to 3.
    // The reinforcement quota of 1 is filled by backfill (new_sequence), never by Q103.
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4), // unseen: new-sequence candidate once lesson 1 is started
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // Good grade, no lapses, future due → falls into no bucket.
      buildState(103, 1),
      // Q104 has no state → new-sequence candidate.
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
    // Q103: 'again' grade, future due, but lastSeenAt is 15 days before now → outside the
    // recency window → not classified as reinforcement. Same inventory guard as the test above.
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // 'again' grade but last seen 15 days ago — outside the 14-day struggle window.
      buildState(103, 1, {
        lastGrade: FsrsReviewGradeValues.again,
        lastSeenAt: new Date('2026-03-02T12:00:00.000Z'),
      }),
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
    // The recency window check is ≤ (inclusive): elapsed ≤ 14 days × ms.
    // A question seen at exactly the boundary must be included, not excluded.
    const now = new Date('2026-03-17T12:00:00.000Z');
    const exactlyFourteenDaysAgo = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000,
    );
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
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
    // One millisecond past the 14-day boundary makes the elapsed time strictly greater than the
    // window — the check is ≤, so this question must be excluded from reinforcement.
    // Q104 has no state, making it a new-sequence candidate that keeps total inventory at MIN (3).
    const now = new Date('2026-03-17T12:00:00.000Z');
    const oneMillisecondPastWindow = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000 - 1,
    );
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4), // unseen → new-sequence to keep totalEligible ≥ 3
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-16T10:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-16T11:00:00.000Z') }),
      // 1 ms past the window → must be excluded despite 'again' grade.
      buildState(103, 1, {
        lastGrade: FsrsReviewGradeValues.again,
        lastSeenAt: oneMillisecondPastWindow,
      }),
      // Q104 has no state row → new-sequence candidate.
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
      buildCandidate(302, 3, 2),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue(
      [] satisfies ModuleUnitProgressRecord[],
    );
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-13T12:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-14T12:00:00.000Z') }),
      buildState(103, 1, { fsrsDueAt: new Date('2026-03-15T12:00:00.000Z') }),
      buildState(201, 2, { fsrsDueAt: new Date('2026-03-16T12:00:00.000Z') }),
      buildState(202, 2, { fsrsDueAt: new Date('2026-03-12T12:00:00.000Z') }),
      buildState(301, 3, {
        fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
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

  // --- new_sequence ordering ---

  it('draws new-sequence candidates exclusively from the earliest started lesson when multiple started lessons exist', async () => {
    // Lesson 1 (completed): three due-review questions → dueReviewCount=3.
    // Lesson 2 (sortOrder=2, started): one seen question + two unseen → new-sequence eligible.
    // Lesson 3 (sortOrder=3, started): one seen question + two unseen → also started, but later.
    // With targetQuestionCount=4, newSequenceQuota=1. The selector must pick from lesson 2 only,
    // because it has the smaller sortOrder (= earlier lesson in the curriculum sequence).
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      // Lesson 1 — completed, all questions have due-review state.
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      // Lesson 2 — started: Q201 is seen, Q202/Q203 are unseen.
      buildCandidate(201, 2, 1),
      buildCandidate(202, 2, 2),
      buildCandidate(203, 2, 3),
      // Lesson 3 — started: Q301 is seen, Q302/Q303 are unseen.
      buildCandidate(301, 3, 1),
      buildCandidate(302, 3, 2),
      buildCandidate(303, 3, 3),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    // Lesson 1 is marked completed so its unseen questions are excluded from new-sequence.
    moduleProgressReadService.listModuleUnitProgress.mockResolvedValue([
      { moduleUnitId: 1, isCompleted: true },
    ] satisfies ModuleUnitProgressRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      // Lesson 1: all three questions are past-due.
      buildState(101, 1, { fsrsDueAt: new Date('2026-03-14T12:00:00.000Z') }),
      buildState(102, 1, { fsrsDueAt: new Date('2026-03-15T12:00:00.000Z') }),
      buildState(103, 1, { fsrsDueAt: new Date('2026-03-16T12:00:00.000Z') }),
      // Lesson 2: Q201 seen (good grade, future due) → marks lesson 2 as "started".
      buildState(201, 2),
      // Lesson 3: Q301 seen (good grade, future due) → marks lesson 3 as "started".
      buildState(301, 3),
      // Q202, Q203, Q302, Q303 have no state → unseen candidates.
    ] satisfies StudentQuestionStateRecord[]);

    // targetQuestionCount=4 forces newSequenceQuota=1 without needing 22+ review-eligible questions.
    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
      targetQuestionCount: 4,
    });

    const newSequenceSelections = result.selectedQuestions.filter(
      (question) =>
        question.sourceBucket ===
        DailyPracticeSelectionBucketValues.newSequence,
    );
    expect(newSequenceSelections).toHaveLength(1);
    // Must be from lesson 2 (sortOrder=2), never from lesson 3 (sortOrder=3).
    expect(newSequenceSelections[0].moduleUnitId).toBe(2);
    expect(
      result.selectedQuestions.some((question) => question.moduleUnitId === 3),
    ).toBe(false);
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
