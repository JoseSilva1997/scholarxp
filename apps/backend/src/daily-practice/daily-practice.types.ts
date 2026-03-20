// Role: shared internal types for the daily-practice domain so read services can stay focused on queries and return stable shapes.
import type { DailyPracticeSelectionBucket } from '@scholarxp/api-contracts';
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

// Selector results stay backend-local so set assembly can evolve without prematurely freezing API response details.
export type SelectedDailyPracticeQuestionRecord =
  DailyPracticeCandidateQuestionRecord & {
    sourceBucket: DailyPracticeSelectionBucket;
    selectionScore: number;
    selectionReason: string;
    studentQuestionState: StudentQuestionStateRecord | null;
  };

// Keeping quotas explicit in the result makes selector behavior easy to assert in tests and easy to inspect while tuning.
export type DailyPracticeSelectionPlan = {
  targetQuestionCount: number;
  dueReviewQuota: number;
  newSequenceQuota: number;
  reinforcementQuota: number;
};

export type DailyPracticeSelectionResult = {
  plan: DailyPracticeSelectionPlan;
  selectedQuestions: SelectedDailyPracticeQuestionRecord[];
};

// Ordered records add a persisted-ready position so the interleaver can hand the next step a stable sequence.
export type OrderedDailyPracticeQuestionRecord =
  SelectedDailyPracticeQuestionRecord & {
    position: number;
  };
