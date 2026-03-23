// Role: validates module-unit progress aggregation semantics from attempt history where latest attempt per question unit wins.
import { Test, TestingModule } from '@nestjs/testing';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import { StudentModuleUnitProgressService } from './student-module-unit-progress.service';

describe('StudentModuleUnitProgressService', () => {
  let service: StudentModuleUnitProgressService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StudentModuleUnitProgressService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get<StudentModuleUnitProgressService>(
      StudentModuleUnitProgressService,
    );
  });

  it('stores zero mastery when there are no eligible questions', async () => {
    const attemptedAt = new Date('2026-02-12T12:00:00Z');

    prisma.questionUnit.count.mockResolvedValue(0);
    prisma.questionAttempt.findMany.mockResolvedValue([]);
    prisma.moduleUnitUserProgress.findUnique.mockResolvedValue(null);
    prisma.moduleUnitUserProgress.upsert.mockResolvedValue({
      moduleUnitId: 10,
      studentId: 100,
      currentMasteryScore: 0,
      noOfCorrectAnswers: 0,
      isCompleted: false,
      completedAt: null,
      lastPracticedAt: attemptedAt,
    } as any);

    const result = await service.syncFromAttempts({
      moduleUnitId: 10,
      studentId: 100,
      attemptedAt,
    });

    expect(prisma.moduleUnitUserProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          currentMasteryScore: 0,
          noOfCorrectAnswers: 0,
          isCompleted: false,
          completedAt: null,
        }),
      }),
    );
    expect(result.currentMasteryScore).toBe(0);
    expect(result.noOfCorrectAnswers).toBe(0);
    expect(result.isCompleted).toBe(false);
  });

  it('counts only question units whose latest attempt is correct', async () => {
    const attemptedAt = new Date('2026-02-12T13:00:00Z');

    prisma.questionUnit.count.mockResolvedValue(3);
    prisma.questionAttempt.findMany.mockResolvedValue([
      // Question 1 latest is incorrect, earlier correct should not count.
      { questionId: 1, isCorrect: false },
      { questionId: 1, isCorrect: true },
      // Question 2 latest is correct.
      { questionId: 2, isCorrect: true },
      { questionId: 2, isCorrect: false },
      // Question 3 has only incorrect.
      { questionId: 3, isCorrect: false },
    ] as any);
    prisma.moduleUnitUserProgress.findUnique.mockResolvedValue(null);
    prisma.moduleUnitUserProgress.upsert.mockResolvedValue({
      moduleUnitId: 10,
      studentId: 100,
      currentMasteryScore: 1 / 3,
      noOfCorrectAnswers: 1,
      isCompleted: false,
      completedAt: null,
      lastPracticedAt: attemptedAt,
    } as any);

    const result = await service.syncFromAttempts({
      moduleUnitId: 10,
      studentId: 100,
      attemptedAt,
    });

    expect(prisma.questionAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          moduleUnitId: 10,
          studentId: 100,
          session: {
            sessionType: PracticeSessionTypeValues.practiceRoom,
          },
        }),
        orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result.noOfCorrectAnswers).toBe(1);
    expect(result.currentMasteryScore).toBeCloseTo(1 / 3);
    expect(result.isCompleted).toBe(false);
  });

  it('keeps the original completedAt when the unit stays completed', async () => {
    const attemptedAt = new Date('2026-02-12T14:00:00Z');
    const originalCompletedAt = new Date('2026-02-10T09:00:00Z');

    prisma.questionUnit.count.mockResolvedValue(2);
    prisma.questionAttempt.findMany.mockResolvedValue([
      { questionId: 1, isCorrect: true },
      { questionId: 2, isCorrect: true },
    ] as any);
    prisma.moduleUnitUserProgress.findUnique.mockResolvedValue({
      isCompleted: true,
      completedAt: originalCompletedAt,
    } as any);
    prisma.moduleUnitUserProgress.upsert.mockResolvedValue({
      moduleUnitId: 10,
      studentId: 100,
      currentMasteryScore: 1,
      noOfCorrectAnswers: 2,
      isCompleted: true,
      completedAt: originalCompletedAt,
      lastPracticedAt: attemptedAt,
    } as any);

    const result = await service.syncFromAttempts({
      moduleUnitId: 10,
      studentId: 100,
      attemptedAt,
    });

    expect(result.isCompleted).toBe(true);
    expect(result.completedAt).toEqual(originalCompletedAt);
  });

  it('sets completedAt to attempt time when completion is reached for the first time', async () => {
    const attemptedAt = new Date('2026-02-12T15:00:00Z');

    prisma.questionUnit.count.mockResolvedValue(1);
    prisma.questionAttempt.findMany.mockResolvedValue([
      { questionId: 1, isCorrect: true },
    ] as any);
    prisma.moduleUnitUserProgress.findUnique.mockResolvedValue({
      isCompleted: false,
      completedAt: null,
    } as any);
    prisma.moduleUnitUserProgress.upsert.mockResolvedValue({
      moduleUnitId: 10,
      studentId: 100,
      currentMasteryScore: 1,
      noOfCorrectAnswers: 1,
      isCompleted: true,
      completedAt: attemptedAt,
      lastPracticedAt: attemptedAt,
    } as any);

    const result = await service.syncFromAttempts({
      moduleUnitId: 10,
      studentId: 100,
      attemptedAt,
    });

    expect(result.isCompleted).toBe(true);
    expect(result.completedAt).toEqual(attemptedAt);
  });

  it('keeps isCompleted true even when later latest attempts are incorrect', async () => {
    const attemptedAt = new Date('2026-02-12T16:00:00Z');
    const originalCompletedAt = new Date('2026-02-12T09:30:00Z');

    prisma.questionUnit.count.mockResolvedValue(2);
    prisma.questionAttempt.findMany.mockResolvedValue([
      // Latest states no longer represent full correctness.
      { questionId: 1, isCorrect: false },
      { questionId: 2, isCorrect: true },
    ] as any);
    prisma.moduleUnitUserProgress.findUnique.mockResolvedValue({
      isCompleted: true,
      completedAt: originalCompletedAt,
    } as any);
    prisma.moduleUnitUserProgress.upsert.mockResolvedValue({
      moduleUnitId: 10,
      studentId: 100,
      currentMasteryScore: 0.5,
      noOfCorrectAnswers: 1,
      isCompleted: true,
      completedAt: originalCompletedAt,
      lastPracticedAt: attemptedAt,
    } as any);

    const result = await service.syncFromAttempts({
      moduleUnitId: 10,
      studentId: 100,
      attemptedAt,
    });

    expect(result.noOfCorrectAnswers).toBe(1);
    expect(result.currentMasteryScore).toBeCloseTo(0.5);
    expect(result.isCompleted).toBe(true);
    expect(result.completedAt).toEqual(originalCompletedAt);
    expect(prisma.moduleUnitUserProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isCompleted: true,
          completedAt: originalCompletedAt,
        }),
      }),
    );
  });
});
