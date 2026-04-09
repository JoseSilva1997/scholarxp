// Covers lesson-focused roster reads so table and drilldown behaviors stay testable below the orchestrator boundary.
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../test/test-helpers';
import { RosterLessonAnalyticsService } from './roster-lesson-analytics.service';

describe('RosterLessonAnalyticsService', () => {
  let service: RosterLessonAnalyticsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RosterLessonAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(RosterLessonAnalyticsService);
  });

  it('returns an empty lessons list when the module has no live lessons', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([] as never);

    await expect(service.getLessons(1, {})).resolves.toEqual({ rows: [] });
  });

  it('throws when the requested lesson does not belong to the module', async () => {
    prisma.moduleUnit.findFirst.mockResolvedValue(null);

    await expect(service.getLessonDrilldown(1, 10)).rejects.toThrow(
      NotFoundException,
    );
  });
});
