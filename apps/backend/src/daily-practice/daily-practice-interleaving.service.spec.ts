// Role: verifies the daily-practice interleaver stays deterministic and avoids same-lesson adjacency whenever the selected set allows it.
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DailyPracticeSelectionBucketValues,
  FsrsReviewGradeValues,
} from '@scholarxp/api-contracts';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import type {
  OrderedDailyPracticeQuestionRecord,
  SelectedDailyPracticeQuestionRecord,
  StudentQuestionStateRecord,
} from './daily-practice.types';

describe('DailyPracticeInterleavingService', () => {
  let service: DailyPracticeInterleavingService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [DailyPracticeInterleavingService],
    }).compile();

    service = moduleRef.get(DailyPracticeInterleavingService);
  });

  it('alternates lessons when alternatives exist', () => {
    const ordered = service.orderSelectedQuestions([
      buildSelectedQuestion(101, 1, 0),
      buildSelectedQuestion(102, 1, 1),
      buildSelectedQuestion(201, 2, 2),
      buildSelectedQuestion(202, 2, 3),
      buildSelectedQuestion(301, 3, 4),
    ]);

    expectOrderedQuestionIds(ordered, [101, 201, 102, 202, 301]);
    expectNoAdjacentSharedLessons(ordered);
  });

  it('preserves each lesson queue order while interleaving', () => {
    const ordered = service.orderSelectedQuestions([
      buildSelectedQuestion(101, 1, 0),
      buildSelectedQuestion(102, 1, 1),
      buildSelectedQuestion(103, 1, 2),
      buildSelectedQuestion(201, 2, 3),
      buildSelectedQuestion(202, 2, 4),
    ]);

    expectOrderedQuestionIds(ordered, [101, 201, 102, 202, 103]);
    expect(ordered.filter((question) => question.moduleUnitId === 1)).toEqual([
      expect.objectContaining({ questionUnitId: 101 }),
      expect.objectContaining({ questionUnitId: 102 }),
      expect.objectContaining({ questionUnitId: 103 }),
    ]);
  });

  it('falls back to same-lesson adjacency only when no alternative lesson remains', () => {
    const ordered = service.orderSelectedQuestions([
      buildSelectedQuestion(101, 1, 0),
      buildSelectedQuestion(102, 1, 1),
      buildSelectedQuestion(103, 1, 2),
      buildSelectedQuestion(201, 2, 3),
    ]);

    expectOrderedQuestionIds(ordered, [101, 201, 102, 103]);
    expect(ordered[2].moduleUnitId).toBe(1);
    expect(ordered[3].moduleUnitId).toBe(1);
  });
});

function expectOrderedQuestionIds(
  orderedQuestions: OrderedDailyPracticeQuestionRecord[],
  expectedQuestionIds: number[],
): void {
  expect(orderedQuestions.map((question) => question.questionUnitId)).toEqual(
    expectedQuestionIds,
  );
  expect(orderedQuestions.map((question) => question.position)).toEqual(
    expectedQuestionIds.map((_, index) => index),
  );
}

function expectNoAdjacentSharedLessons(
  orderedQuestions: OrderedDailyPracticeQuestionRecord[],
): void {
  for (let index = 1; index < orderedQuestions.length; index += 1) {
    expect(orderedQuestions[index].moduleUnitId).not.toBe(
      orderedQuestions[index - 1].moduleUnitId,
    );
  }
}

function buildSelectedQuestion(
  questionUnitId: number,
  moduleUnitId: number,
  selectionScore: number,
): SelectedDailyPracticeQuestionRecord {
  return {
    moduleUnitId,
    moduleUnitTitle: `Lesson ${moduleUnitId}`,
    moduleUnitSortOrder: moduleUnitId,
    questionUnitId,
    questionUnitTitle: `Question ${questionUnitId}`,
    questionGroupId: moduleUnitId * 10,
    questionGroupSortOrder: questionUnitId,
    coreContentId: questionUnitId * 10,
    questionType: 'multiple_choice',
    questionDifficultyScore: 0.5,
    sourceBucket: DailyPracticeSelectionBucketValues.dueReview,
    selectionScore,
    selectionReason: 'Selected for testing.',
    studentQuestionState: buildStudentQuestionState(
      questionUnitId,
      moduleUnitId,
    ),
  };
}

function buildStudentQuestionState(
  questionUnitId: number,
  moduleUnitId: number,
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
    fsrsLastReviewedAt: new Date('2026-03-18T12:00:00.000Z'),
    reviewCount: 3,
    lapseCount: 0,
    lastGrade: FsrsReviewGradeValues.good,
    lastSeenAt: new Date('2026-03-18T12:00:00.000Z'),
    lastCorrectAt: new Date('2026-03-18T12:00:00.000Z'),
    recentAvgTimeMs: 7000,
    firstSeenAt: new Date('2026-03-10T12:00:00.000Z'),
    algorithmVersion: 'fsrs_v1',
  };
}
