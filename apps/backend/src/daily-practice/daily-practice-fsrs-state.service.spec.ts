// Role: verifies daily-practice encounters persist state only on the first correct encounter and delegate schedule math to the policy service.
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DailyPracticeAlgorithmVersionValues,
  FsrsCardStateValues,
  FsrsReviewGradeValues,
} from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
import { DailyPracticeFsrsPolicyService } from './daily-practice-fsrs-policy.service';
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
  let policyService: {
    computeSeedStateForFirstCorrect: jest.Mock;
    computeNextStateForExisting: jest.Mock;
  };

  const reviewedAt = new Date('2026-03-17T10:00:00.000Z');
  const snappedDueAt = new Date('2026-03-20T05:00:00.000Z');

  beforeEach(async () => {
    prisma = createPrismaMock();
    questionStateReadService = {
      findStateForQuestion: jest.fn(),
    };
    fsrsGradeService = {
      mapEncounterToGrade: jest.fn(),
      toFsrsRating: jest.fn(),
    };
    policyService = {
      computeSeedStateForFirstCorrect: jest.fn(),
      computeNextStateForExisting: jest.fn(),
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
        {
          provide: DailyPracticeFsrsPolicyService,
          useValue: policyService,
        },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeFsrsStateService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates no state on a first-ever incorrect encounter', async () => {
    questionStateReadService.findStateForQuestion.mockResolvedValue(null);
    fsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.again,
    );

    const result = await service.applyEncounter({
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      reviewedAt,
      firstAttemptCorrect: false,
      hintUnlocked: false,
      timeTakenMs: 9000,
      timezone: 'UTC',
      priorEncounterExists: false,
    });

    expect(result).toBeNull();
    expect(prisma.studentQuestionState.upsert).not.toHaveBeenCalled();
    expect(
      policyService.computeSeedStateForFirstCorrect,
    ).not.toHaveBeenCalled();
    expect(policyService.computeNextStateForExisting).not.toHaveBeenCalled();
    expect(prisma.questionAttempt.findMany).not.toHaveBeenCalled();
  });

  it('seeds and persists state on the first correct encounter using policy output', async () => {
    questionStateReadService.findStateForQuestion.mockResolvedValue(null);
    fsrsGradeService.mapEncounterToGrade.mockReturnValue(
      FsrsReviewGradeValues.good,
    );
    prisma.questionAttempt.findMany.mockResolvedValue([
      { isCorrect: false, hintsUsed: 0, timeTakenMs: 12000 },
      { isCorrect: false, hintsUsed: 1, timeTakenMs: 15000 },
      { isCorrect: true, hintsUsed: 0, timeTakenMs: 7000 },
    ] as never);
    policyService.computeSeedStateForFirstCorrect.mockReturnValue({
      state: FsrsCardStateValues.review,
      stability: 1.4,
      difficulty: 3.1,
      dueAt: snappedDueAt,
      reps: 1,
      lapses: 0,
    });
    prisma.studentQuestionState.upsert.mockResolvedValue({
      id: 'state-1',
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      fsrsState: FsrsCardStateValues.review,
      fsrsDifficulty: 3.1,
      fsrsStability: 1.4,
      fsrsDueAt: snappedDueAt,
      fsrsLastReviewedAt: reviewedAt,
      reviewCount: 1,
      lapseCount: 0,
      lastGrade: FsrsReviewGradeValues.good,
      lastSeenAt: reviewedAt,
      lastCorrectAt: reviewedAt,
      recentAvgTimeMs: 7000,
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
      timeTakenMs: 7000,
      timezone: 'America/New_York',
      // Late-correct after wrong attempts in the same window: state still seeds because no card exists yet.
      priorEncounterExists: true,
    });

    expect(policyService.computeSeedStateForFirstCorrect).toHaveBeenCalledWith({
      grade: FsrsReviewGradeValues.good,
      reviewedAt,
      timezone: 'America/New_York',
      evidence: {
        priorFailedAttempts: 2,
        priorHintedAttempts: 1,
        // Time-to-first-correct aggregates all prior + current attempts.
        timeToFirstCorrectMs: 12000 + 15000 + 7000,
      },
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
          fsrsState: FsrsCardStateValues.review,
          fsrsStability: 1.4,
          fsrsDifficulty: 3.1,
          fsrsDueAt: snappedDueAt,
          lastGrade: FsrsReviewGradeValues.good,
          lastCorrectAt: reviewedAt,
          firstSeenAt: reviewedAt,
          recentAvgTimeMs: 7000,
          algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
        }),
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.fsrsState).toBe(FsrsCardStateValues.review);
    expect(result?.fsrsDueAt).toEqual(snappedDueAt);
  });

  it('updates existing state via policy for subsequent reviews and preserves first-seen / last-correct', async () => {
    const firstSeenAt = new Date('2026-03-10T08:00:00.000Z');
    const lastCorrectAt = new Date('2026-03-15T12:00:00.000Z');
    const existingState: StudentQuestionStateRecord = {
      id: '9c7fb5c4-79a8-4e05-99f7-6bba1cde1c75',
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      fsrsState: FsrsCardStateValues.review,
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
    policyService.computeNextStateForExisting.mockReturnValue({
      state: FsrsCardStateValues.review,
      stability: 4.2,
      difficulty: 6.3,
      dueAt: snappedDueAt,
      reps: 5,
      lapses: 2,
    });
    prisma.studentQuestionState.upsert.mockResolvedValue({
      ...existingState,
      fsrsStability: 4.2,
      fsrsDifficulty: 6.3,
      fsrsDueAt: snappedDueAt,
      lapseCount: 2,
      reviewCount: 5,
      lastGrade: FsrsReviewGradeValues.again,
      lastSeenAt: reviewedAt,
      recentAvgTimeMs: 8600,
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
      timezone: 'UTC',
      priorEncounterExists: false,
    });

    expect(policyService.computeNextStateForExisting).toHaveBeenCalledWith({
      existingState,
      grade: FsrsReviewGradeValues.again,
      reviewedAt,
      timezone: 'UTC',
    });
    expect(
      policyService.computeSeedStateForFirstCorrect,
    ).not.toHaveBeenCalled();
    expect(prisma.studentQuestionState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          fsrsState: FsrsCardStateValues.review,
          fsrsStability: 4.2,
          fsrsDifficulty: 6.3,
          fsrsDueAt: snappedDueAt,
          lapseCount: 2,
          reviewCount: 5,
          lastGrade: FsrsReviewGradeValues.again,
          lastCorrectAt,
          firstSeenAt,
          recentAvgTimeMs: 8600,
        }),
      }),
    );
    expect(result?.firstSeenAt).toEqual(firstSeenAt);
    expect(result?.lastCorrectAt).toEqual(lastCorrectAt);
  });

  it('returns null without re-grading when state already exists and the caller window already saw an attempt', async () => {
    const existingState: StudentQuestionStateRecord = {
      id: 'state-existing',
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      fsrsState: FsrsCardStateValues.review,
      fsrsDifficulty: 5,
      fsrsStability: 12,
      fsrsDueAt: new Date('2026-03-18T00:00:00.000Z'),
      fsrsLastReviewedAt: new Date('2026-03-15T00:00:00.000Z'),
      reviewCount: 3,
      lapseCount: 0,
      lastGrade: FsrsReviewGradeValues.good,
      lastSeenAt: new Date('2026-03-15T00:00:00.000Z'),
      lastCorrectAt: new Date('2026-03-15T00:00:00.000Z'),
      recentAvgTimeMs: 6000,
      firstSeenAt: new Date('2026-03-10T00:00:00.000Z'),
      algorithmVersion: DailyPracticeAlgorithmVersionValues.fsrsV1,
    };
    questionStateReadService.findStateForQuestion.mockResolvedValue(
      existingState,
    );

    const result = await service.applyEncounter({
      userId: 42,
      moduleId: 7,
      moduleUnitId: 15,
      questionUnitId: 91,
      reviewedAt,
      firstAttemptCorrect: false,
      hintUnlocked: false,
      timeTakenMs: 10000,
      timezone: 'UTC',
      priorEncounterExists: true,
    });

    expect(result).toBeNull();
    expect(policyService.computeNextStateForExisting).not.toHaveBeenCalled();
    expect(
      policyService.computeSeedStateForFirstCorrect,
    ).not.toHaveBeenCalled();
    expect(prisma.studentQuestionState.upsert).not.toHaveBeenCalled();
    // Grading is gated before mapEncounterToGrade, so even the grade lookup must be skipped.
    expect(fsrsGradeService.mapEncounterToGrade).not.toHaveBeenCalled();
  });
});
