// Role: shared internal types for the daily-practice domain so read services can stay focused on queries and return stable shapes.
import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export type PrismaClientLike = Prisma.TransactionClient | PrismaService;

// Persisted question-state reads keep raw Date objects internally so later mappers can decide API string formatting centrally.
export type StudentQuestionStateRecord = {
  id: string;
  userId: number;
  moduleId: number;
  moduleUnitId: number;
  questionUnitId: number;
  fsrsState: string;
  fsrsDifficulty: number;
  fsrsStability: number;
  fsrsDueAt: Date;
  fsrsLastReviewedAt: Date | null;
  reviewCount: number;
  lapseCount: number;
  lastGrade: string | null;
  lastSeenAt: Date | null;
  lastCorrectAt: Date | null;
  recentAvgTimeMs: number | null;
  firstSeenAt: Date | null;
  algorithmVersion: string;
};

// Candidate questions expose the minimum selector inputs needed for future FSRS-backed set generation.
export type DailyPracticeCandidateQuestionRecord = {
  moduleUnitId: number;
  moduleUnitTitle: string;
  moduleUnitSortOrder: number;
  questionUnitId: number;
  questionUnitTitle: string;
  questionGroupId: number | null;
  questionGroupSortOrder: number | null;
  coreContentId: number;
  questionType: string;
  questionDifficultyScore: number;
};

// Persisted daily-practice sets keep ordered items attached so later controllers can hydrate the set in one read.
export type PersistedDailyPracticeSetRecord = {
  id: string;
  userId: number;
  moduleId: number;
  practiceDateUtc: Date;
  generatedAt: Date;
  completedAt: Date | null;
  algorithmVersion: string;
  items: Array<{
    id: string;
    dailyPracticeSetId: string;
    questionUnitId: number;
    moduleUnitId: number;
    position: number;
    selectionReason: string;
    selectionScore: number;
    sourceBucket: string;
  }>;
};
