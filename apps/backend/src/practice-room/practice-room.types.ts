// Internal practice-room types keep DB payload and mapper contracts explicit without leaking Prisma models.
import type { Prisma } from '@prisma/client';
import type { QuestionData, questionType } from '@scholarxp/question-type-dtos';

export type LatestAttemptSnapshot = {
  questionId: number;
  contentId: number;
  studentAnswer: Prisma.JsonValue;
  isCorrect: boolean;
  attemptedAt: Date;
};

export type RoomQuestionContent = {
  id: number;
  type: questionType;
  questionStem: string;
  questionData: QuestionData;
  hint: string | null;
};

export type RoomQuestion = {
  questionId: number;
  questionContent: RoomQuestionContent;
};

export type RoomQuestionUnitDraft = {
  questionUnitId: number;
  coreContentId: number;
  coreQuestion: RoomQuestion;
};

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

export type OwnedPracticeSession = {
  id: string;
  sessionType: string;
  endTime: Date | null;
};

export type RoomContext = {
  moduleUnit: LoadedModuleUnit;
  isReadOnly: boolean;
  session: OwnedPracticeSession;
  questionUnitDrafts: RoomQuestionUnitDraft[];
};
