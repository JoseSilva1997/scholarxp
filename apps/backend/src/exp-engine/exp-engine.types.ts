// Type role: centralizes shared exp-engine contracts so services reuse one source of truth for params/results.
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Use a single shared transaction-client union so service methods accept both root Prisma and transactional clients.
export type PrismaClientLike = Prisma.TransactionClient | PrismaService;

// Parameters required to award account XP when a student finishes a module unit lesson.
export type AwardCompletionExpParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  completedAt: Date;
};

// Parameters derived from the submit-attempt payload used to determine module XP eligibility
// per question. The three boolean flags encode the attempt history needed to apply first-attempt
// and hint-penalty rules without re-querying the database inside the awarding service.
export type AwardAttemptModuleExpParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  questionUnitId: number;
  isCorrect: boolean;
  hadCorrectAttemptBeforeSubmit: boolean;
  hadAnyAttemptBeforeSubmit: boolean;
  // Snapshot from submit payload: true means the learner unlocked hint before this submission.
  hintUnlockedOnSubmit: boolean;
};

// Return value of awardAttemptModuleExp: a breakdown of each XP component plus the updated
// membership record so the route handler can assemble the client response without extra queries.
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

// Snapshot of the eligible question pool for a unit, used to compute per-question XP shares
// and to identify the last question, which absorbs any rounding remainder.
export type PracticeQuestionContext = {
  totalQuestions: number;
  lastQuestionId: number | null;
};

// Parameters for the streak bonus evaluation, which requires the total question count
// to compute percentage-based tier thresholds at award time.
export type AwardStreakBonusParams = {
  studentId: number;
  moduleId: number;
  moduleUnitId: number;
  sessionId: string;
  totalQuestions: number;
};
