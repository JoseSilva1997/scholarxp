// Covers student-focused roster reads so list and detail logic stay verifiable outside the top-level orchestrator.
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

  describe('removeStudent', () => {
    it('rejects self-removal so staff cannot silently revoke their own access', async () => {
      await expect(service.removeStudent(1, 42, 42)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.userModule.findUnique).not.toHaveBeenCalled();
      expect(prisma.userModule.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target has no enrollment in the module', async () => {
      prisma.userModule.findUnique.mockResolvedValue(null);

      await expect(service.removeStudent(1, 5, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.userModule.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target is not enrolled as a student', async () => {
      prisma.userModule.findUnique.mockResolvedValue({
        id: 10,
        roleInModule: 'teacher',
      } as never);

      await expect(service.removeStudent(1, 5, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.userModule.delete).not.toHaveBeenCalled();
    });

    it('deletes the membership row and returns the removed student id', async () => {
      prisma.userModule.findUnique.mockResolvedValue({
        id: 77,
        roleInModule: 'student',
      } as never);
      prisma.userModule.delete.mockResolvedValue({ id: 77 } as never);

      await expect(service.removeStudent(1, 5, 99)).resolves.toEqual({
        removedStudentId: 5,
      });
      expect(prisma.userModule.delete).toHaveBeenCalledWith({
        where: { id: 77 },
      });
    });
  });
});
