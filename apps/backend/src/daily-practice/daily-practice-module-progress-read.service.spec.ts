// Role: verifies that listModuleUnitProgress delegates to prisma with the right filters and honours the optional transaction client.
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeModuleProgressReadService } from './daily-practice-module-progress-read.service';
import type { ModuleUnitProgressRecord } from './daily-practice.types';

describe('DailyPracticeModuleProgressReadService', () => {
  let service: DailyPracticeModuleProgressReadService;
  let prisma: { moduleUnitUserProgress: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { moduleUnitUserProgress: { findMany: jest.fn() } };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeModuleProgressReadService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeModuleProgressReadService);
  });

  it('returns progress records from prisma', async () => {
    const rows: ModuleUnitProgressRecord[] = [
      { moduleUnitId: 1, isCompleted: true },
      { moduleUnitId: 2, isCompleted: false },
    ];
    prisma.moduleUnitUserProgress.findMany.mockResolvedValue(rows);

    const result = await service.listModuleUnitProgress(42, 7);

    expect(result).toEqual(rows);
  });

  it('returns an empty array when the student has no progress rows', async () => {
    prisma.moduleUnitUserProgress.findMany.mockResolvedValue([]);

    const result = await service.listModuleUnitProgress(42, 7);

    expect(result).toEqual([]);
  });

  it('queries with the correct userId and moduleId filters', async () => {
    prisma.moduleUnitUserProgress.findMany.mockResolvedValue([]);

    await service.listModuleUnitProgress(42, 7);

    expect(prisma.moduleUnitUserProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId: 42,
          moduleUnit: { moduleId: 7 },
        },
      }),
    );
  });

  it('uses the provided transaction client instead of the injected prisma', async () => {
    const txClient = {
      moduleUnitUserProgress: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await service.listModuleUnitProgress(42, 7, txClient as any);

    expect(txClient.moduleUnitUserProgress.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.moduleUnitUserProgress.findMany).not.toHaveBeenCalled();
  });
});
