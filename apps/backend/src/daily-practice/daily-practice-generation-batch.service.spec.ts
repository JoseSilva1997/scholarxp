// Role: verifies midnight daily-practice generation covers all student enrollments without one failure stopping the batch.
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { DailyPracticeGenerationBatchService } from './daily-practice-generation-batch.service';
import { DailyPracticeGenerationService } from './daily-practice-generation.service';

describe('DailyPracticeGenerationBatchService', () => {
  let service: DailyPracticeGenerationBatchService;
  let prisma: PrismaMock;
  let dailyPracticeGenerationService: {
    ensureSetGenerated: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    dailyPracticeGenerationService = {
      ensureSetGenerated: jest
        .fn()
        .mockResolvedValue({ status: 'already_exists' }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DailyPracticeGenerationBatchService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: DailyPracticeGenerationService,
          useValue: dailyPracticeGenerationService,
        },
      ],
    }).compile();

    service = moduleRef.get(DailyPracticeGenerationBatchService);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('generates daily-practice sets for each student-module membership in ascending batches', async () => {
    const timestamp = new Date('2026-03-24T00:00:00.000Z');

    prisma.userModule.findMany
      .mockResolvedValueOnce([
        { id: 4, userId: 10, moduleId: 7, user: { timezone: 'UTC' } },
        { id: 8, userId: 10, moduleId: 9, user: { timezone: 'UTC' } },
      ] as never)
      .mockResolvedValueOnce([
        { id: 12, userId: 14, moduleId: 5, user: { timezone: 'UTC' } },
      ] as never)
      .mockResolvedValueOnce([] as never);
    dailyPracticeGenerationService.ensureSetGenerated
      .mockResolvedValueOnce({ status: 'created' })
      .mockResolvedValueOnce({ status: 'already_exists' })
      .mockResolvedValueOnce({ status: 'no_set' });

    const result = await service.generateDailyPracticeSetsForAllStudents(
      timestamp,
      2,
    );

    expect(prisma.userModule.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        roleInModule: 'student',
        module: { archivedAt: null },
      },
      select: {
        id: true,
        userId: true,
        moduleId: true,
        user: {
          select: {
            timezone: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: 2,
    });
    expect(prisma.userModule.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        roleInModule: 'student',
        module: { archivedAt: null },
        id: {
          gt: 8,
        },
      },
      select: {
        id: true,
        userId: true,
        moduleId: true,
        user: {
          select: {
            timezone: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: 2,
    });
    expect(prisma.userModule.findMany).toHaveBeenNthCalledWith(3, {
      where: {
        roleInModule: 'student',
        module: { archivedAt: null },
        id: {
          gt: 12,
        },
      },
      select: {
        id: true,
        userId: true,
        moduleId: true,
        user: {
          select: {
            timezone: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: 2,
    });
    expect(
      dailyPracticeGenerationService.ensureSetGenerated,
    ).toHaveBeenNthCalledWith(1, 7, 10, timestamp);
    expect(
      dailyPracticeGenerationService.ensureSetGenerated,
    ).toHaveBeenNthCalledWith(2, 9, 10, timestamp);
    expect(
      dailyPracticeGenerationService.ensureSetGenerated,
    ).toHaveBeenNthCalledWith(3, 5, 14, timestamp);
    expect(result).toEqual({
      processedMembershipCount: 3,
      createdSetCount: 1,
      failedMembershipCount: 0,
    });
  });

  it('continues later memberships when one generation fails', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    prisma.userModule.findMany
      .mockResolvedValueOnce([
        { id: 4, userId: 10, moduleId: 7, user: { timezone: 'UTC' } },
        { id: 8, userId: 10, moduleId: 9, user: { timezone: 'UTC' } },
      ] as never)
      .mockResolvedValueOnce([] as never);
    dailyPracticeGenerationService.ensureSetGenerated
      .mockResolvedValueOnce({ status: 'created' })
      .mockRejectedValueOnce(new Error('db timeout'));

    const result = await service.generateDailyPracticeSetsForAllStudents(
      new Date('2026-03-24T00:00:00.000Z'),
      50,
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to generate daily practice for user 10 in module 9.',
      expect.any(String),
    );
    expect(result).toEqual({
      processedMembershipCount: 1,
      createdSetCount: 1,
      failedMembershipCount: 1,
    });
  });

  it('normalizes invalid batch sizes so the job still progresses', async () => {
    prisma.userModule.findMany
      .mockResolvedValueOnce([
        { id: 4, userId: 10, moduleId: 7, user: { timezone: 'UTC' } },
      ] as never)
      .mockResolvedValueOnce([] as never);

    await service.generateDailyPracticeSetsForAllStudents(
      new Date('2026-03-24T00:00:00.000Z'),
      0,
    );

    expect(prisma.userModule.findMany).toHaveBeenCalledWith({
      where: {
        roleInModule: 'student',
        module: { archivedAt: null },
      },
      select: {
        id: true,
        userId: true,
        moduleId: true,
        user: {
          select: {
            timezone: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: 1,
    });
  });

  it('filters scheduled generation to memberships that are near local midnight', async () => {
    const timestamp = new Date('2026-03-23T18:15:00.000Z');

    prisma.userModule.findMany
      .mockResolvedValueOnce([
        {
          id: 4,
          userId: 10,
          moduleId: 7,
          user: { timezone: 'Asia/Kathmandu' },
        },
        {
          id: 8,
          userId: 12,
          moduleId: 9,
          user: { timezone: 'America/New_York' },
        },
        { id: 12, userId: 14, moduleId: 5, user: { timezone: 'UTC' } },
      ] as never)
      .mockResolvedValueOnce([] as never);
    dailyPracticeGenerationService.ensureSetGenerated.mockResolvedValueOnce({
      status: 'created',
    });

    const result = await service.generateDailyPracticeSetsForAllStudents(
      timestamp,
      50,
      { onlyLocalMidnightWindow: true },
    );

    expect(
      dailyPracticeGenerationService.ensureSetGenerated,
    ).toHaveBeenCalledTimes(1);
    expect(
      dailyPracticeGenerationService.ensureSetGenerated,
    ).toHaveBeenNthCalledWith(1, 7, 10, timestamp);
    expect(result).toEqual({
      processedMembershipCount: 1,
      createdSetCount: 1,
      failedMembershipCount: 0,
    });
  });
});
