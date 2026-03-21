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
