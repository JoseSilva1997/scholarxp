// Type role: centralizes shared exp-engine contracts so services reuse one source of truth for params/results.
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Use a single shared transaction-client union so service methods accept both root Prisma and transactional clients.
export type PrismaClientLike = Prisma.TransactionClient | PrismaService;

export type AwardCompletionExpParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  completedAt: Date;
};

export type AwardAttemptModuleExpParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  questionUnitId: number;
  isCorrect: boolean;
  hadCorrectAttemptBeforeSubmit: boolean;
  hadAnyAttemptBeforeSubmit: boolean;
};

export type AttemptModuleExpRewardResult = {
  moduleExpAwarded: number;
  moduleAwards: {
    baseQuestionExp: number;
    firstAttemptBonus: number;
    streakBonus: number;
  };
  updatedMembership: Prisma.UserModuleGetPayload<{
    include: { module: true };
  }> | null;
};

export type PracticeQuestionContext = {
  totalQuestions: number;
  lastQuestionId: number | null;
};

export type AwardStreakBonusParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  totalQuestions: number;
};
