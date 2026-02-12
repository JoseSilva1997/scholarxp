// Role: derives and persists student module-unit progress aggregates from validated practice attempts.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

type SyncStudentModuleUnitProgressParams = {
  moduleUnitId: number;
  studentId: number;
  attemptedAt: Date;
};

export type StudentModuleUnitProgressSnapshot = {
  moduleUnitId: number;
  studentId: number;
  currentMasteryScore: number;
  noOfCorrectAnswers: number;
  isCompleted: boolean;
  completedAt: Date | null;
  lastPracticedAt: Date;
};

@Injectable()
export class StudentModuleUnitProgressService {
  constructor(private readonly prisma: PrismaService) {}

  // Rebuilds persisted unit progress from attempts so submit flow remains deterministic across retries and retries-in-session.
  async syncFromAttempts(
    params: SyncStudentModuleUnitProgressParams,
    tx?: PrismaClientLike,
  ): Promise<StudentModuleUnitProgressSnapshot> {
    const prismaClient = tx ?? this.prisma;

    // Progress should only consider active question units that still expose a non-archived core question.
    const totalEligibleQuestions = await prismaClient.questionUnit.count({
      where: {
        moduleUnitId: params.moduleUnitId,
        isArchived: false,
        contents: {
          some: {
            isCore: true,
            isArchived: false,
          },
        },
      },
    });

    // Distinct correct question-unit ids represent solved units regardless of variant used for the first correct answer.
    const correctAttempts = await prismaClient.questionAttempt.findMany({
      where: {
        moduleUnitId: params.moduleUnitId,
        studentId: params.studentId,
        isCorrect: true,
        question: {
          isArchived: false,
          contents: {
            some: {
              isCore: true,
              isArchived: false,
            },
          },
        },
      },
      distinct: ['questionId'],
      select: {
        questionId: true,
      },
    });

    const noOfCorrectAnswers = correctAttempts.length;
    const currentMasteryScore =
      totalEligibleQuestions > 0
        ? noOfCorrectAnswers / totalEligibleQuestions
        : 0;
    const isCompleted =
      totalEligibleQuestions > 0 &&
      noOfCorrectAnswers >= totalEligibleQuestions;

    // Completion timestamp is sticky across future attempts and only resets if the unit is no longer complete.
    const existingProgress =
      await prismaClient.moduleUnitUserProgress.findUnique({
        where: {
          moduleUnitId_studentId: {
            moduleUnitId: params.moduleUnitId,
            studentId: params.studentId,
          },
        },
        select: {
          completedAt: true,
          isCompleted: true,
        },
      });

    const completedAt = this.resolveCompletedAt({
      isCompleted,
      attemptedAt: params.attemptedAt,
      existingCompletedAt: existingProgress?.completedAt ?? null,
      wasCompleted: existingProgress?.isCompleted ?? false,
    });

    const persisted = await prismaClient.moduleUnitUserProgress.upsert({
      where: {
        moduleUnitId_studentId: {
          moduleUnitId: params.moduleUnitId,
          studentId: params.studentId,
        },
      },
      create: {
        moduleUnitId: params.moduleUnitId,
        studentId: params.studentId,
        currentMasteryScore,
        noOfCorrectAnswers,
        isCompleted,
        completedAt,
        lastPracticedAt: params.attemptedAt,
      },
      update: {
        currentMasteryScore,
        noOfCorrectAnswers,
        isCompleted,
        completedAt,
        lastPracticedAt: params.attemptedAt,
      },
      select: {
        moduleUnitId: true,
        studentId: true,
        currentMasteryScore: true,
        noOfCorrectAnswers: true,
        isCompleted: true,
        completedAt: true,
        lastPracticedAt: true,
      },
    });

    return {
      moduleUnitId: persisted.moduleUnitId,
      studentId: persisted.studentId ?? params.studentId,
      currentMasteryScore: persisted.currentMasteryScore,
      noOfCorrectAnswers: persisted.noOfCorrectAnswers,
      isCompleted: persisted.isCompleted,
      completedAt: persisted.completedAt,
      lastPracticedAt: persisted.lastPracticedAt ?? params.attemptedAt,
    };
  }

  private resolveCompletedAt(input: {
    isCompleted: boolean;
    attemptedAt: Date;
    existingCompletedAt: Date | null;
    wasCompleted: boolean;
  }): Date | null {
    if (!input.isCompleted) {
      return null;
    }

    // Keeping the original completion timestamp preserves when the student first mastered the unit.
    if (input.wasCompleted && input.existingCompletedAt) {
      return input.existingCompletedAt;
    }

    return input.attemptedAt;
  }
}
