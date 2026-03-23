// Role: derives and persists student module-unit progress aggregates from validated practice attempts.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PracticeSessionTypeValues } from '@scholarxp/api-contracts';
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

  // Rebuilds persisted unit progress from attempts so submit flow remains deterministic across retries and sessions.
  async syncFromAttempts(
    params: SyncStudentModuleUnitProgressParams,
    tx?: PrismaClientLike,
  ): Promise<StudentModuleUnitProgressSnapshot> {
    const prismaClient = tx ?? this.prisma;

    const totalEligibleQuestions = await this.countEligibleQuestionUnits(
      params.moduleUnitId,
      prismaClient,
    );
    const noOfCorrectAnswers = await this.countCorrectLatestAttempts(
      params.moduleUnitId,
      params.studentId,
      totalEligibleQuestions,
      prismaClient,
    );
    const currentMasteryScore = this.calculateMasteryScore(
      noOfCorrectAnswers,
      totalEligibleQuestions,
    );
    const isCompletedFromLatestAttempts = this.calculateIsCompleted(
      noOfCorrectAnswers,
      totalEligibleQuestions,
    );

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

    // Completion is sticky: once achieved, it should not regress on later incorrect attempts.
    const isCompleted =
      existingProgress?.isCompleted === true || isCompletedFromLatestAttempts;
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

  // Progress should only consider active question units that still expose a non-archived core question.
  private countEligibleQuestionUnits(
    moduleUnitId: number,
    prismaClient: PrismaClientLike,
  ): Promise<number> {
    return prismaClient.questionUnit.count({
      where: {
        moduleUnitId,
        isArchived: false,
        contents: {
          some: {
            isCore: true,
            isArchived: false,
          },
        },
      },
    });
  }

  // Latest-attempt-wins semantics are implemented by loading ordered attempts and keeping the first hit per question id.
  private async countCorrectLatestAttempts(
    moduleUnitId: number,
    studentId: number,
    totalEligibleQuestions: number,
    prismaClient: PrismaClientLike,
  ): Promise<number> {
    if (totalEligibleQuestions === 0) {
      return 0;
    }

    const attempts = await prismaClient.questionAttempt.findMany({
      where: {
        moduleUnitId,
        studentId,
        // Daily practice and retry are separate loops; unit completion should only reflect lesson practice history.
        session: {
          sessionType: PracticeSessionTypeValues.practiceRoom,
        },
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
      orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
      select: {
        questionId: true,
        isCorrect: true,
      },
    });

    const latestAttemptByQuestionId = new Map<number, boolean>();
    for (const attempt of attempts) {
      if (latestAttemptByQuestionId.has(attempt.questionId)) {
        continue;
      }
      latestAttemptByQuestionId.set(attempt.questionId, attempt.isCorrect);
    }

    return Array.from(latestAttemptByQuestionId.values()).filter(Boolean)
      .length;
  }

  // Keeping this explicit makes mastery math easy to reuse and easy to test in isolation later.
  private calculateMasteryScore(
    noOfCorrectAnswers: number,
    totalEligibleQuestions: number,
  ): number {
    if (totalEligibleQuestions <= 0) {
      return 0;
    }

    return noOfCorrectAnswers / totalEligibleQuestions;
  }

  // Completion requires at least one eligible question and all of them currently answered correctly.
  private calculateIsCompleted(
    noOfCorrectAnswers: number,
    totalEligibleQuestions: number,
  ): boolean {
    return (
      totalEligibleQuestions > 0 && noOfCorrectAnswers >= totalEligibleQuestions
    );
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
