// Spec role: verifies batched daily-quest generation can cover all students without one failure stopping the rollover job.
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { QuestGenerationBatchService } from './quest-generation-batch.service';
import { QuestGenerationService } from './quest-generation.service';

describe('QuestGenerationBatchService', () => {
  let service: QuestGenerationBatchService;
  let prisma: PrismaMock;
  let questGenerationService: {
    ensureQuestDayGeneratedForUser: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    questGenerationService = {
      ensureQuestDayGeneratedForUser: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuestGenerationBatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuestGenerationService, useValue: questGenerationService },
      ],
    }).compile();

    service = moduleRef.get(QuestGenerationBatchService);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('generates quests for each distinct student in ascending batches', async () => {
    prisma.userModule.findMany
      .mockResolvedValueOnce([{ userId: 4 }, { userId: 9 }] as never)
      .mockResolvedValueOnce([{ userId: 15 }] as never)
      .mockResolvedValueOnce([] as never);

    const timestamp = new Date('2026-03-15T00:00:00.000Z');

    const result = await service.generateQuestDayForAllStudents(timestamp, 2);

    expect(prisma.userModule.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        roleInModule: 'student',
        module: { archivedAt: null },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
      orderBy: {
        userId: 'asc',
      },
      take: 2,
    });
    expect(prisma.userModule.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        roleInModule: 'student',
        module: { archivedAt: null },
        userId: {
          gt: 9,
        },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
      orderBy: {
        userId: 'asc',
      },
      take: 2,
    });
    expect(
      questGenerationService.ensureQuestDayGeneratedForUser,
    ).toHaveBeenNthCalledWith(1, 4, timestamp);
    expect(
      questGenerationService.ensureQuestDayGeneratedForUser,
    ).toHaveBeenNthCalledWith(2, 9, timestamp);
    expect(
      questGenerationService.ensureQuestDayGeneratedForUser,
    ).toHaveBeenNthCalledWith(3, 15, timestamp);

    expect(result).toEqual({
      processedUserCount: 3,
      failedUserCount: 0,
    });
  });

  it('continues processing later students when one generation fails', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    prisma.userModule.findMany
      .mockResolvedValueOnce([{ userId: 4 }, { userId: 9 }] as never)
      .mockResolvedValueOnce([] as never);
    questGenerationService.ensureQuestDayGeneratedForUser
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('database timeout'));

    const result = await service.generateQuestDayForAllStudents(
      new Date('2026-03-15T00:00:00.000Z'),
      50,
    );
    expect(
      questGenerationService.ensureQuestDayGeneratedForUser,
    ).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to generate daily quests for student 9.',
      expect.any(String),
    );
    expect(result).toEqual({
      processedUserCount: 1,
      failedUserCount: 1,
    });
  });

  it('normalizes invalid batch sizes so the job still progresses', async () => {
    prisma.userModule.findMany
      .mockResolvedValueOnce([{ userId: 4 }] as never)
      .mockResolvedValueOnce([] as never);

    await service.generateQuestDayForAllStudents(
      new Date('2026-03-15T00:00:00.000Z'),
      0,
    );

    expect(prisma.userModule.findMany).toHaveBeenCalledWith({
      where: {
        roleInModule: 'student',
        module: { archivedAt: null },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
      orderBy: {
        userId: 'asc',
      },
      take: 1,
    });
  });
});
