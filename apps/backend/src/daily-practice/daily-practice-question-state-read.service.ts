// Role: owns read-only access to persisted per-student question review state for the daily-practice domain.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  PrismaClientLike,
  StudentQuestionStateRecord,
} from './daily-practice.types';

@Injectable()
export class DailyPracticeQuestionStateReadService {
  constructor(private readonly prisma: PrismaService) {}

  // Module-scoped reads are the hot path for future selector logic, so this service keeps the query centralized and index-aligned.
  listStatesForModule(
    userId: number,
    moduleId: number,
    tx?: PrismaClientLike,
  ): Promise<StudentQuestionStateRecord[]> {
    const prismaClient = tx ?? this.prisma;

    return prismaClient.studentQuestionState.findMany({
      where: {
        userId,
        moduleId,
      },
      orderBy: [{ fsrsDueAt: 'asc' }, { questionUnitId: 'asc' }],
      select: {
        id: true,
        userId: true,
        moduleId: true,
        moduleUnitId: true,
        questionUnitId: true,
        fsrsState: true,
        fsrsDifficulty: true,
        fsrsStability: true,
        fsrsDueAt: true,
        fsrsLastReviewedAt: true,
        reviewCount: true,
        lapseCount: true,
        lastGrade: true,
        lastSeenAt: true,
        lastCorrectAt: true,
        recentAvgTimeMs: true,
        firstSeenAt: true,
        algorithmVersion: true,
      },
    });
  }

  // Question-level lookup keeps encounter/update flows free from duplicated Prisma selection boilerplate.
  findStateForQuestion(
    userId: number,
    questionUnitId: number,
    tx?: PrismaClientLike,
  ): Promise<StudentQuestionStateRecord | null> {
    const prismaClient = tx ?? this.prisma;

    return prismaClient.studentQuestionState.findUnique({
      where: {
        userId_questionUnitId: {
          userId,
          questionUnitId,
        },
      },
      select: {
        id: true,
        userId: true,
        moduleId: true,
        moduleUnitId: true,
        questionUnitId: true,
        fsrsState: true,
        fsrsDifficulty: true,
        fsrsStability: true,
        fsrsDueAt: true,
        fsrsLastReviewedAt: true,
        reviewCount: true,
        lapseCount: true,
        lastGrade: true,
        lastSeenAt: true,
        lastCorrectAt: true,
        recentAvgTimeMs: true,
        firstSeenAt: true,
        algorithmVersion: true,
      },
    });
  }
}
