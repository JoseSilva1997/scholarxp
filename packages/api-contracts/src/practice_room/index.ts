import type { QuestionData, questionType } from '@scholarxp/question-type-dtos';
import type { PracticeMode } from '@scholarxp/constants';

// Module-unit-scoped room payload used by the current practice-room flow.
export interface ModuleUnitPracticeRoom {
  sessionId: number;
  moduleUnitId: number;
  moduleUnitTitle: string;
  questions: PracticeQuestionUnit[];
}


//One question unit rendered as a single question in the room.
export interface PracticeQuestionUnit {
  questionUnitId: number;
  position: number;
  hasCorrectAttempt: boolean | null;
  coreQuestion: PracticeQuestionWithLatestAttempt;
}


//Question payload and optional last attempt
export interface PracticeQuestionWithLatestAttempt {
  questionId: number;
  questionContent: PracticeQuestion;
  lastAttempt: PracticeAttemptSnapshot | null;
}


//Minimal attempt contract kept intentionally generic until attempt workflows are implemented.
export interface PracticeAttemptSnapshot {
  studentAnswer: StudentAnswer | null;
  isCorrect: boolean | null;
}


//Shared render shape for a core practice question.
export interface PracticeQuestion {
  id: number;
  type: questionType;
  questionStem: string;
  questionData: QuestionData;
  hint: string | null;
  difficultyScore: number;
}

// Union type for all possible student answer shapes, allowing for future question types to be added without breaking existing contracts.
export type StudentAnswer = McqAnswer | TrueFalseAnswer | GenericAnswer; // For future question types, we can use this generic shape to allow flexibility while maintaining type safety.


export interface McqAnswer {
  selectedOptionIndex: number;
}

export interface TrueFalseAnswer {
  selectedOptionIndex: number;
}

// For future question types, we can extend this union with new interfaces as needed.
export interface GenericAnswer  {
  data: Record<string, unknown>;
}

/* ================================================================================================================================================
    Payloads and response shapes for the practice room module.
   ================================================================================================================================================
*/

// Payload used to create or load a module-unit-scoped practice room session.
export interface CreateModuleUnitPracticeRoomPayload {
  moduleUnitId: number;
}

// Optional query params for loading a room; when provided, sessionId resumes an in-progress session.
export interface GetModuleUnitPracticeRoomQuery {
  sessionId?: number;
}

// Top-level response used by the module-unit practice room page on initial load.
export interface ModuleUnitPracticeRoomResponse {
  practiceRoom: ModuleUnitPracticeRoom;
}

// Payload user for submitting an attempt
export interface SubmitAttemptPayload {
  moduleUnitId: number;
  questionUnitId: number;
  questionContentId: number;
  sessionId: number;
  practiceMode: PracticeMode;
  timeTakenMs: number;
  hintUnlocked: boolean;
  studentAnswer: StudentAnswer;
}

// Response sent back to the frontend after submitting an attempt.
export interface SubmitAttemptResponse {
  moduleExpAwarded: number;
  studentExpAwarded: number;
  hasCorrectAttempt: boolean;
}
