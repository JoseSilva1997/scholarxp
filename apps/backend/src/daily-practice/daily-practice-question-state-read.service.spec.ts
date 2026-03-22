// Role: verifies that listStatesForModule and findStateForQuestion delegate to prisma with the right filters and honour the optional transaction client.
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import type { StudentQuestionStateRecord } from './daily-practice.types';

describe('DailyPracticeQuestionStateReadService', () => {
  let service: DailyPracticeQuestionStateReadService;
  let prisma: {
    studentQuestionState: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      studentQuestionState: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeQuestionStateReadService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeQuestionStateReadService);
  });

  // ── listStatesForModule ────────────────────────────────────────────────────

  describe('listStatesForModule', () => {
    it('returns state records from prisma', async () => {
      const rows: StudentQuestionStateRecord[] = [
        buildState(10, 42, 7, 1),
        buildState(11, 42, 7, 1),
      ];
      prisma.studentQuestionState.findMany.mockResolvedValue(rows);

      const result = await service.listStatesForModule(42, 7);

      expect(result).toEqual(rows);
    });

    it('returns an empty array when no states exist for the module', async () => {
      prisma.studentQuestionState.findMany.mockResolvedValue([]);

      const result = await service.listStatesForModule(42, 7);

      expect(result).toEqual([]);
    });

    it('queries with the correct userId and moduleId', async () => {
      prisma.studentQuestionState.findMany.mockResolvedValue([]);

      await service.listStatesForModule(42, 7);

      expect(prisma.studentQuestionState.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 42, moduleId: 7 },
        }),
      );
    });

    it('uses the provided transaction client instead of the injected prisma', async () => {
      const txClient = {
        studentQuestionState: { findMany: jest.fn().mockResolvedValue([]) },
      };

      await service.listStatesForModule(42, 7, txClient as any);

      expect(txClient.studentQuestionState.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.studentQuestionState.findMany).not.toHaveBeenCalled();
    });
  });

  // ── findStateForQuestion ───────────────────────────────────────────────────

  describe('findStateForQuestion', () => {
    it('returns the matching state record', async () => {
      const row = buildState(10, 42, 7, 1);
      prisma.studentQuestionState.findUnique.mockResolvedValue(row);

      const result = await service.findStateForQuestion(42, 10);

      expect(result).toEqual(row);
    });

    it('returns null when no state exists for the question', async () => {
      prisma.studentQuestionState.findUnique.mockResolvedValue(null);

      const result = await service.findStateForQuestion(42, 10);

      expect(result).toBeNull();
    });

    it('queries with the composite unique key', async () => {
      prisma.studentQuestionState.findUnique.mockResolvedValue(null);

      await service.findStateForQuestion(42, 10);

      expect(prisma.studentQuestionState.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_questionUnitId: { userId: 42, questionUnitId: 10 },
          },
        }),
      );
    });

    it('uses the provided transaction client instead of the injected prisma', async () => {
      const txClient = {
        studentQuestionState: { findUnique: jest.fn().mockResolvedValue(null) },
      };

      await service.findStateForQuestion(42, 10, txClient as any);

      expect(txClient.studentQuestionState.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.studentQuestionState.findUnique).not.toHaveBeenCalled();
    });
  });
});

// ── Builder ────────────────────────────────────────────────────────────────

function buildState(
  questionUnitId: number,
  userId: number,
  moduleId: number,
  moduleUnitId: number,
): StudentQuestionStateRecord {
  return {
    id: `state-${questionUnitId}`,
    userId,
    moduleId,
    moduleUnitId,
    questionUnitId,
    fsrsState: 'review',
    fsrsDifficulty: 5,
    fsrsStability: 2,
    fsrsDueAt: new Date('2026-03-20T12:00:00.000Z'),
    fsrsLastReviewedAt: new Date('2026-03-18T12:00:00.000Z'),
    reviewCount: 3,
    lapseCount: 0,
    lastGrade: 'good',
    lastSeenAt: new Date('2026-03-18T12:00:00.000Z'),
    lastCorrectAt: new Date('2026-03-18T12:00:00.000Z'),
    recentAvgTimeMs: 7000,
    firstSeenAt: new Date('2026-03-10T12:00:00.000Z'),
    algorithmVersion: 'fsrs_v1',
  };
}
