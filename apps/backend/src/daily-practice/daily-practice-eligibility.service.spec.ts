// Role: verifies that assertEligibleForToday throws the right ForbiddenException for locked/unlocks-tomorrow states and passes through when eligible.
import { ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeEligibilityService } from './daily-practice-eligibility.service';

const NOW = new Date('2026-03-22T14:00:00.000Z');
const TODAY_START = new Date('2026-03-22T00:00:00.000Z');
const YESTERDAY = new Date('2026-03-21T23:59:59.999Z');
const EARLIER_TODAY = new Date('2026-03-22T08:00:00.000Z');

describe('DailyPracticeEligibilityService', () => {
  let service: DailyPracticeEligibilityService;
  let prisma: { moduleUnitUserProgress: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { moduleUnitUserProgress: { findFirst: jest.fn() } };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeEligibilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeEligibilityService);
  });

  it('resolves without error when the earliest completion was before today', async () => {
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      completedAt: YESTERDAY,
    });

    await expect(
      service.assertEligibleForToday(7, 42, NOW),
    ).resolves.toBeUndefined();
  });

  it('throws ForbiddenException when no module unit has been completed', async () => {
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue(null);

    await expect(service.assertEligibleForToday(7, 42, NOW)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.assertEligibleForToday(7, 42, NOW)).rejects.toThrow(
      'Complete your first lesson in this module to unlock daily practice tomorrow.',
    );
  });

  it('throws ForbiddenException when the earliest completion is exactly at the UTC day boundary', async () => {
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      completedAt: TODAY_START,
    });

    await expect(service.assertEligibleForToday(7, 42, NOW)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.assertEligibleForToday(7, 42, NOW)).rejects.toThrow(
      'Daily practice unlocks tomorrow after you complete your first lesson in this module.',
    );
  });

  it('throws ForbiddenException when the earliest completion is later today', async () => {
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      completedAt: EARLIER_TODAY,
    });

    await expect(service.assertEligibleForToday(7, 42, NOW)).rejects.toThrow(
      'Daily practice unlocks tomorrow after you complete your first lesson in this module.',
    );
  });

  it('queries with the correct studentId, moduleId, and completion filters', async () => {
    prisma.moduleUnitUserProgress.findFirst.mockResolvedValue({
      completedAt: YESTERDAY,
    });

    await service.assertEligibleForToday(7, 42, NOW);

    expect(prisma.moduleUnitUserProgress.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: 42,
          isCompleted: true,
          moduleUnit: { moduleId: 7 },
        }),
      }),
    );
  });
});
