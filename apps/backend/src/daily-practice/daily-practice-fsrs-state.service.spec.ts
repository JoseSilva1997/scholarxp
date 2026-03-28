// Role: verifies daily-practice encounters persist stable FSRS-backed question state without mutating raw attempt semantics.
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DailyPracticeAlgorithmVersionValues,
  FsrsReviewGradeValues,
} from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
import { DailyPracticeFsrsStateService } from './daily-practice-fsrs-state.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import type { StudentQuestionStateRecord } from './daily-practice.types';

describe('DailyPracticeFsrsStateService', () => {
  let service: DailyPracticeFsrsStateService;
  let prisma: PrismaMock;
  let questionStateReadService: {
    findStateForQuestion: jest.Mock;
  };
  let fsrsGradeService: {
    mapEncounterToGrade: jest.Mock;
    toFsrsRating: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    questionStateReadService = {
      findStateForQuestion: jest.fn(),
    };
    fsrsGradeService = {
      mapEncounterToGrade: jest.fn(),
      toFsrsRating: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeFsrsStateService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: DailyPracticeQuestionStateReadService,
          useValue: questionStateReadService,
        },
        {
          provide: DailyPracticeFsrsGradeService,
          useValue: fsrsGradeService,
        },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeFsrsStateService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a new student question state for a first encounter', async () => {
    const reviewedAt = new Date('2026-03-17T10:00:00.000Z');
    questionStateReadService.findStateForQuestion.mockResolvedValue(null);
    fsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.good,
    );
    fsrsGradeService.toFsrsRating.mockReturnValue(3);
    prisma.studentQuestionState.upsert.mockResolvedValue({
      id: '2b1da040-73fe-4ab8-a015-fd0bd9d5ce92',
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      fsrsState: 'learning',
      fsrsDifficulty: 5,
      fsrsStability: 0.4,
      fsrsDueAt: new Date('2026-03-18T10:00:00.000Z'),
      fsrsLastReviewedAt: reviewedAt,
      reviewCount: 1,
      lapseCount: 0,
      lastGrade: FsrsReviewGradeValues.good,
      lastSeenAt: reviewedAt,
      lastCorrectAt: reviewedAt,
      recentAvgTimeMs: 9000,
      firstSeenAt: reviewedAt,
      algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
    } as never);

    const result = await service.applyEncounter({
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      reviewedAt,
      firstAttemptCorrect: true,
      hintUnlocked: false,
      timeTakenMs: 9000,
    });

    expect(questionStateReadService.findStateForQuestion).toHaveBeenCalledWith(
      42,
      91,
      prisma,
    );
    expect(fsrsGradeService.mapEncounterToGrade).toHaveBeenCalledWith({
      firstAttemptCorrect: true,
      hintUnlocked: false,
    });
    expect(prisma.studentQuestionState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_questionUnitId: {
            userId: 42,
            questionUnitId: 91,
          },
        },
        create: expect.objectContaining({
          userId: 42,
          moduleId: 7,
          moduleUnitId: 15,
          questionUnitId: 91,
          lastGrade: FsrsReviewGradeValues.good,
          lastSeenAt: reviewedAt,
          lastCorrectAt: reviewedAt,
          recentAvgTimeMs: 9000,
          firstSeenAt: reviewedAt,
          algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
        }),
      }),
    );
    expect(result.algorithmVersion).toBe(
      DailyPracticeAlgorithmVersionValues.fsrsV1,
    );
    expect(result.lastCorrectAt).toEqual(reviewedAt);
  });

  it('graduates a learning-state card with correct stability when graded good', async () => {
    // A card with fsrsState="learning" and low stability from a prior "again" grade
    // must be reconstructed as State.Review so the elapsed-time-aware recall formula is used.
    // Previously, learning_steps=0 caused ts-fsrs to use next_short_term_stability,
    // which gave ~0.246 stability regardless of how many days had elapsed since the last review.
    const reviewedAt = new Date('2026-03-17T10:00:00.000Z');
    const existingState: StudentQuestionStateRecord = {
      id: 'a1b2c3d4-0000-0000-0000-000000000001',
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      fsrsState: 'learning',
      fsrsDifficulty: 6.4,
      fsrsStability: 0.21,
      fsrsDueAt: new Date('2026-03-16T10:00:00.000Z'),
      fsrsLastReviewedAt: new Date('2026-03-16T10:00:00.000Z'),
      reviewCount: 1,
      lapseCount: 0,
      lastGrade: FsrsReviewGradeValues.again,
      lastSeenAt: new Date('2026-03-16T10:00:00.000Z'),
      lastCorrectAt: null,
      recentAvgTimeMs: null,
      firstSeenAt: new Date('2026-03-16T10:00:00.000Z'),
      algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
    };

    questionStateReadService.findStateForQuestion.mockResolvedValue(
      existingState,
    );
    fsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.good,
    );
    fsrsGradeService.toFsrsRating.mockReturnValue(3);
    prisma.studentQuestionState.upsert.mockResolvedValue({
      ...existingState,
      fsrsState: 'review',
      lastGrade: FsrsReviewGradeValues.good,
    } as never);

    await service.applyEncounter({
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      reviewedAt,
      firstAttemptCorrect: true,
      hintUnlocked: false,
      timeTakenMs: 5000,
    });

    const upsertArgs = prisma.studentQuestionState.upsert.mock.calls[0][0];
    // Graduated to review, not stuck in learning.
    expect(upsertArgs.update.fsrsState).toBe('review');
    // Stability must exceed the 0.246 value produced by the short-term formula —
    // the recall formula uses elapsed days and gives a meaningfully higher result.
    expect(upsertArgs.update.fsrsStability).toBeGreaterThan(0.246);
  });

  it('moves a learning-state card to relearning and increments lapse count when graded again', async () => {
    // Under the old path, "again" on a learning card stayed in Learning with no lapse recorded.
    // Reconstructing as Review means reviewState("again") fires, which correctly moves the
    // card to Relearning and increments lapses — consistent with any other failed review.
    const reviewedAt = new Date('2026-03-17T10:00:00.000Z');
    const existingState: StudentQuestionStateRecord = {
      id: 'a1b2c3d4-0000-0000-0000-000000000002',
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      fsrsState: 'learning',
      fsrsDifficulty: 2.5,
      fsrsStability: 2.3,
      fsrsDueAt: new Date('2026-03-16T10:00:00.000Z'),
      fsrsLastReviewedAt: new Date('2026-03-16T10:00:00.000Z'),
      reviewCount: 1,
      lapseCount: 0,
      lastGrade: FsrsReviewGradeValues.good,
      lastSeenAt: new Date('2026-03-16T10:00:00.000Z'),
      lastCorrectAt: new Date('2026-03-16T10:00:00.000Z'),
      recentAvgTimeMs: 4000,
      firstSeenAt: new Date('2026-03-16T10:00:00.000Z'),
      algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
    };

    questionStateReadService.findStateForQuestion.mockResolvedValue(
      existingState,
    );
    fsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.again,
    );
    fsrsGradeService.toFsrsRating.mockReturnValue(1);
    prisma.studentQuestionState.upsert.mockResolvedValue({
      ...existingState,
      fsrsState: 'relearning',
      lapseCount: 1,
      lastGrade: FsrsReviewGradeValues.again,
    } as never);

    await service.applyEncounter({
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      reviewedAt,
      firstAttemptCorrect: false,
      hintUnlocked: false,
      timeTakenMs: 8000,
    });

    const upsertArgs = prisma.studentQuestionState.upsert.mock.calls[0][0];
    // Failure on a learning card now records a proper lapse.
    expect(upsertArgs.update.fsrsState).toBe('relearning');
    expect(upsertArgs.update.lapseCount).toBe(1);
  });

  it('preserves first seen and last correct timestamps on incorrect later reviews', async () => {
    const firstSeenAt = new Date('2026-03-10T08:00:00.000Z');
    const lastCorrectAt = new Date('2026-03-15T12:00:00.000Z');
    const reviewedAt = new Date('2026-03-17T10:00:00.000Z');
    const existingState: StudentQuestionStateRecord = {
      id: '9c7fb5c4-79a8-4e05-99f7-6bba1cde1c75',
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      fsrsState: 'review',
      fsrsDifficulty: 5.2,
      fsrsStability: 13.5,
      fsrsDueAt: new Date('2026-03-18T10:00:00.000Z'),
      fsrsLastReviewedAt: new Date('2026-03-16T10:00:00.000Z'),
      reviewCount: 4,
      lapseCount: 1,
      lastGrade: FsrsReviewGradeValues.good,
      lastSeenAt: new Date('2026-03-16T10:00:00.000Z'),
      lastCorrectAt,
      recentAvgTimeMs: 8000,
      firstSeenAt,
      algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
    };

    questionStateReadService.findStateForQuestion.mockResolvedValue(
      existingState,
    );
    fsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.again,
    );
    fsrsGradeService.toFsrsRating.mockReturnValue(1);
    prisma.studentQuestionState.upsert.mockResolvedValue({
      ...existingState,
      lastGrade: FsrsReviewGradeValues.again,
      lastSeenAt: reviewedAt,
      recentAvgTimeMs: 8600,
      algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
    } as never);

    const result = await service.applyEncounter({
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      reviewedAt,
      firstAttemptCorrect: false,
      hintUnlocked: false,
      timeTakenMs: 10000,
    });

    expect(prisma.studentQuestionState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          lastGrade: FsrsReviewGradeValues.again,
          lastSeenAt: reviewedAt,
          lastCorrectAt,
          firstSeenAt,
          recentAvgTimeMs: 8600,
          algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
        }),
      }),
    );
    expect(result.firstSeenAt).toEqual(firstSeenAt);
    expect(result.lastCorrectAt).toEqual(lastCorrectAt);
    expect(result.recentAvgTimeMs).toBe(8600);
  });
});
