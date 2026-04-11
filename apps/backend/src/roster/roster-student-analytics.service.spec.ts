// Covers student-focused roster reads so list and detail logic stay verifiable outside the top-level orchestrator.
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DailyPracticeService } from '../daily-practice/daily-practice.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, PrismaMock } from '../test/test-helpers';
import { RosterStudentAnalyticsService } from './roster-student-analytics.service';

describe('RosterStudentAnalyticsService', () => {
  let service: RosterStudentAnalyticsService;
  let prisma: PrismaMock;
  let dailyPracticeService: { getDailyPracticeStatus: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    dailyPracticeService = {
      getDailyPracticeStatus: jest.fn().mockResolvedValue({ status: 'locked' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RosterStudentAnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: DailyPracticeService, useValue: dailyPracticeService },
      ],
    }).compile();

    service = module.get(RosterStudentAnalyticsService);
  });

  it('returns an empty students list when no enrollments exist', async () => {
    prisma.moduleUnit.findMany.mockResolvedValue([] as never);
    prisma.userModule.findMany.mockResolvedValue([] as never);

    await expect(service.getStudents(1, {})).resolves.toEqual({ rows: [] });
  });

  it('throws when the requested student is not enrolled in the module', async () => {
    prisma.userModule.findUnique.mockResolvedValue(null);

    await expect(service.getStudentDetail(1, 1)).rejects.toThrow(
      NotFoundException,
    );
  });
});
