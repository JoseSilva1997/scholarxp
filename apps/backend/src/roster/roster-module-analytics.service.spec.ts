// Covers module-level roster summary behavior so the orchestration layer can delegate without hiding regressions.
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../test/test-helpers';
import { RosterModuleAnalyticsService } from './roster-module-analytics.service';

describe('RosterModuleAnalyticsService', () => {
  let service: RosterModuleAnalyticsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RosterModuleAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RosterModuleAnalyticsService);
  });

  it('throws when the requested module does not exist', async () => {
    prisma.module.findUnique.mockResolvedValue(null);

    await expect(service.getSummary(999)).rejects.toThrow(NotFoundException);
  });

  it('counts only lessons completed by at least half of enrolled students', async () => {
    prisma.module.findUnique.mockResolvedValue({
      id: 7,
      title: 'Geometry',
    } as any);
    prisma.moduleUnit.findMany.mockResolvedValue([
      { id: 101 },
      { id: 102 },
      { id: 103 },
    ] as any);
    prisma.userModule.findMany.mockResolvedValue([
      { userId: 1 },
      { userId: 2 },
      { userId: 3 },
    ] as any);
    prisma.questionAttempt.findMany.mockResolvedValue([
      { studentId: 1 },
      { studentId: 2 },
    ] as any);
    prisma.moduleUnitUserProgress.findMany.mockResolvedValue([
      { moduleUnitId: 101 },
      { moduleUnitId: 102 },
      { moduleUnitId: 103 },
    ] as any);
    prisma.moduleUnitUserProgress.groupBy.mockResolvedValue([
      { moduleUnitId: 101, _count: { studentId: 1 } },
      { moduleUnitId: 102, _count: { studentId: 2 } },
      { moduleUnitId: 103, _count: { studentId: 3 } },
    ] as any);

    const result = await service.getSummary(7);

    expect(result.lessonCoverage).toEqual({
      totalLiveLessons: 3,
      lessonsStartedByAtLeastOneStudent: 3,
      lessonsCompletedByAtLeastHalfOfStudents: 2,
    });
  });
});
