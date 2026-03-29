// Role: verifies that findSetForUtcDay, findSetById, and findOwnedSetById delegate to prisma with the right filters and honour the optional transaction client.
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import type { PersistedDailyPracticeSetRecord } from './daily-practice.types';

const NOW = new Date('2026-03-22T14:00:00.000Z');
const TODAY_UTC = new Date('2026-03-22T00:00:00.000Z');

describe('DailyPracticeSetReadService', () => {
  let service: DailyPracticeSetReadService;
  let prisma: {
    dailyPracticeSet: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      dailyPracticeSet: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeSetReadService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeSetReadService);
  });

  // ── findSetForUtcDay ───────────────────────────────────────────────────────

  describe('findSetForUtcDay', () => {
    it('returns the set when one exists for the UTC day', async () => {
      const row = buildSet('set-1', 42, 7);
      prisma.dailyPracticeSet.findUnique.mockResolvedValue(row);

      const result = await service.findSetForUtcDay(42, 7, NOW);

      expect(result).toEqual(row);
    });

    it('returns null when no set exists for the UTC day', async () => {
      prisma.dailyPracticeSet.findUnique.mockResolvedValue(null);

      const result = await service.findSetForUtcDay(42, 7, NOW);

      expect(result).toBeNull();
    });

    it('queries using the composite key with the UTC day start', async () => {
      prisma.dailyPracticeSet.findUnique.mockResolvedValue(null);

      await service.findSetForUtcDay(42, 7, NOW);

      expect(prisma.dailyPracticeSet.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_moduleId_practiceDateUtc: {
              userId: 42,
              moduleId: 7,
              practiceDateUtc: TODAY_UTC,
            },
          },
        }),
      );
    });

    it('normalises mid-day timestamps to the UTC day start', async () => {
      prisma.dailyPracticeSet.findUnique.mockResolvedValue(null);
      const midday = new Date('2026-03-22T23:59:59.999Z');

      await service.findSetForUtcDay(42, 7, midday);

      expect(prisma.dailyPracticeSet.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId_moduleId_practiceDateUtc: expect.objectContaining({
              practiceDateUtc: TODAY_UTC,
            }),
          }),
        }),
      );
    });

    it('uses the provided transaction client instead of the injected prisma', async () => {
      const txClient = {
        dailyPracticeSet: { findUnique: jest.fn().mockResolvedValue(null) },
      };

      await service.findSetForUtcDay(42, 7, NOW, 'UTC', txClient as any);

      expect(txClient.dailyPracticeSet.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.dailyPracticeSet.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── findSetById ────────────────────────────────────────────────────────────

  describe('findSetById', () => {
    it('returns the set when found', async () => {
      const row = buildSet('set-1', 42, 7);
      prisma.dailyPracticeSet.findUnique.mockResolvedValue(row);

      const result = await service.findSetById('set-1');

      expect(result).toEqual(row);
    });

    it('returns null when the set does not exist', async () => {
      prisma.dailyPracticeSet.findUnique.mockResolvedValue(null);

      const result = await service.findSetById('set-999');

      expect(result).toBeNull();
    });

    it('queries by id only', async () => {
      prisma.dailyPracticeSet.findUnique.mockResolvedValue(null);

      await service.findSetById('set-1');

      expect(prisma.dailyPracticeSet.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'set-1' } }),
      );
    });

    it('uses the provided transaction client instead of the injected prisma', async () => {
      const txClient = {
        dailyPracticeSet: { findUnique: jest.fn().mockResolvedValue(null) },
      };

      await service.findSetById('set-1', txClient as any);

      expect(txClient.dailyPracticeSet.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.dailyPracticeSet.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── findOwnedSetById ───────────────────────────────────────────────────────

  describe('findOwnedSetById', () => {
    it('returns the set when it belongs to the user and module', async () => {
      const row = buildSet('set-1', 42, 7);
      prisma.dailyPracticeSet.findFirst.mockResolvedValue(row);

      const result = await service.findOwnedSetById('set-1', 42, 7);

      expect(result).toEqual(row);
    });

    it('returns null when no matching owned set is found', async () => {
      prisma.dailyPracticeSet.findFirst.mockResolvedValue(null);

      const result = await service.findOwnedSetById('set-1', 42, 7);

      expect(result).toBeNull();
    });

    it('queries with id, userId, and moduleId to enforce ownership', async () => {
      prisma.dailyPracticeSet.findFirst.mockResolvedValue(null);

      await service.findOwnedSetById('set-1', 42, 7);

      expect(prisma.dailyPracticeSet.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'set-1', userId: 42, moduleId: 7 },
        }),
      );
    });

    it('uses the provided transaction client instead of the injected prisma', async () => {
      const txClient = {
        dailyPracticeSet: { findFirst: jest.fn().mockResolvedValue(null) },
      };

      await service.findOwnedSetById('set-1', 42, 7, txClient as any);

      expect(txClient.dailyPracticeSet.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.dailyPracticeSet.findFirst).not.toHaveBeenCalled();
    });
  });
});

// ── Builder ────────────────────────────────────────────────────────────────

function buildSet(
  id: string,
  userId: number,
  moduleId: number,
): PersistedDailyPracticeSetRecord {
  return {
    id,
    userId,
    moduleId,
    practiceDateUtc: TODAY_UTC,
    generatedAt: NOW,
    completedAt: null,
    algorithmVersion: 'fsrs_v1',
    items: [
      {
        id: `item-${id}-1`,
        dailyPracticeSetId: id,
        questionUnitId: 10,
        questionContentId: 100,
        moduleUnitId: 1,
        position: 0,
        selectionReason: 'due_review',
        selectionScore: 0.8,
        sourceBucket: 'due_review',
      },
    ],
  };
}
