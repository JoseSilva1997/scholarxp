// Role: verifies the daily-practice selector keeps module-scoped quotas and fallback rules deterministic as adaptive policy evolves.
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

  it('selects default due, new-sequence, and reinforcement quotas for a seven-question set', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(201, 2, 1),
      buildCandidate(202, 2, 2),
      buildCandidate(301, 3, 1),
      buildCandidate(302, 3, 2),
      buildCandidate(401, 4, 1),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(201, 2, {
        fsrsDueAt: new Date('2026-03-15T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
      }),
      buildState(202, 2, {
        fsrsDueAt: new Date('2026-03-16T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
      }),
      buildState(301, 3, {
        fsrsDueAt: new Date('2026-03-14T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
      }),
      buildState(302, 3, {
        fsrsDueAt: new Date('2026-03-13T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.good,
      }),
      buildState(401, 4, {
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
      targetQuestionCount: 7,
      dueReviewQuota: 4,
      newSequenceQuota: 2,
      reinforcementQuota: 1,
    });
    expect(result.selectedQuestions).toHaveLength(7);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.dueReview,
      ),
    ).toHaveLength(4);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.newSequence,
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
      result.selectedQuestions
        .filter(
          (question) =>
            question.sourceBucket ===
            DailyPracticeSelectionBucketValues.newSequence,
        )
        .every((question) => question.moduleUnitId === 1),
    ).toBe(true);
  });

  it('backfills due shortfalls from reinforcement and then new-sequence candidates', async () => {
    const now = new Date('2026-03-17T12:00:00.000Z');
    candidateReadService.listModuleCandidateQuestions.mockResolvedValue([
      buildCandidate(101, 1, 1),
      buildCandidate(102, 1, 2),
      buildCandidate(103, 1, 3),
      buildCandidate(104, 1, 4),
      buildCandidate(201, 2, 1),
      buildCandidate(202, 2, 2),
      buildCandidate(301, 3, 1),
      buildCandidate(302, 3, 2),
    ] satisfies DailyPracticeCandidateQuestionRecord[]);
    questionStateReadService.listStatesForModule.mockResolvedValue([
      buildState(201, 2, {
        fsrsDueAt: new Date('2026-03-16T12:00:00.000Z'),
      }),
      buildState(202, 2, {
        fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.again,
        lastSeenAt: new Date('2026-03-16T12:00:00.000Z'),
      }),
      buildState(301, 3, {
        fsrsDueAt: new Date('2026-03-21T12:00:00.000Z'),
        lastGrade: FsrsReviewGradeValues.hard,
        lastSeenAt: new Date('2026-03-15T12:00:00.000Z'),
      }),
    ] satisfies StudentQuestionStateRecord[]);

    const result = await service.selectQuestions({
      userId: 42,
      moduleId: 7,
      now,
    });

    expect(result.selectedQuestions).toHaveLength(7);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.reinforcement,
      ),
    ).toHaveLength(2);
    expect(
      result.selectedQuestions.filter(
        (question) =>
          question.sourceBucket ===
          DailyPracticeSelectionBucketValues.newSequence,
      ),
    ).toHaveLength(4);
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
        fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
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
