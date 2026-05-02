// Internal practice-room types keep DB payload and mapper contracts explicit without leaking Prisma models.
// These types form a thin translation layer between Prisma query results and room-domain logic.
import type { Prisma } from '@prisma/client';
import type { QuestionData, questionType } from '@scholarxp/question-type-dtos';

// Snapshot of the most-recent attempt for one (questionId, contentId) pair — used to
// pre-populate answers and determine solved state on room load.
export type LatestAttemptSnapshot = {
  questionId: number;
  contentId: number;
  studentAnswer: Prisma.JsonValue;
  isCorrect: boolean;
  attemptedAt: Date;
};

// Strongly typed view of a single question's content needed for rendering and grading.
export type RoomQuestionContent = {
  id: number;
  type: questionType;
  questionStem: string;
  questionData: QuestionData;
  hint: string | null;
};

// Pairs a question-unit id with its content so the mapper can build room payloads
// without carrying the full Prisma shape beyond the query boundary.
export type RoomQuestion = {
  questionId: number;
  questionContent: RoomQuestionContent;
};

// Intermediate draft produced by the mapper before the full response is assembled;
// retains the coreContentId so attempt lookups can key on (questionUnitId, coreContentId).
export type RoomQuestionUnitDraft = {
  questionUnitId: number;
  coreContentId: number;
  coreQuestion: RoomQuestion;
};

// Raw module-unit shape returned from Prisma and consumed by the mapper; kept narrow
// (select-based) to avoid pulling in unneeded relations during room load.
export type LoadedModuleUnit = {
  id: number;
  title: string;
  questionUnits: {
    id: number;
    contents: {
      id: number;
      type: string;
      isCore: boolean;
      questionStem: string;
      questionData: Prisma.JsonValue;
      hint: string | null;
    }[];
  }[];
};

// Minimum session fields needed for room-level ownership checks and submit-flow guards,
// without pulling in attempt or user relations.
export type OwnedPracticeSession = {
  id: string;
  sessionType: string;
  endTime: Date | null;
};

// Aggregates everything the read service resolves at room-load time so the facade
// can delegate all lookup sequencing to a single async call.
export type RoomContext = {
  moduleUnit: LoadedModuleUnit;
  isReadOnly: boolean;
  session: OwnedPracticeSession;
  questionUnitDrafts: RoomQuestionUnitDraft[];
};
