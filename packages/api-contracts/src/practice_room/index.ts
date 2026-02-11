import type { QuestionData, questionType } from '@scholarxp/question-type-dtos';
import { PRACTICE_MODES } from '@scholarxp/constants';

// Render-focused session payload with question units in display order.
export interface PracticeRoom {
  sessionId: string;
  moduleUnitId: number;
  moduleUnitTitle: string;
  questions: PracticeRoomQuestionUnit[];
}


//One question unit rendered as a single question in the room.
export interface PracticeRoomQuestionUnit {
  questionUnitId: number;
  position: number;
  hasCorrectAttempt: boolean | null;
  coreQuestion: QuestionWithLatestAttempt;
  variants: QuestionWithLatestAttempt[];
}


//Question payload and optional last attempt, defined now to avoid later contract churn.
export interface QuestionWithLatestAttempt {
  questionId: number;
  questionContent: PracticeRoomQuestion;
  lastAttempt: PracticeRoomAttempt | null;
}


//Minimal attempt contract kept intentionally generic until attempt workflows are implemented.
export interface PracticeRoomAttempt {
  studentAnswer: StudentAnswer | null;
  isCorrect: boolean | null;
  attemptedAt: string;
}


//Shared render shape for a core question or one of its variants.
export interface PracticeRoomQuestion {
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

//Payload used to create or load a student's active practice room session.
export interface CreatePracticeRoomPayload {
  moduleUnitId: number;
  studentId: number;
}


//Top-level response used by the practice room page on initial load.
export interface PracticeRoomResponse {
  practiceRoom: PracticeRoom;
}

// Payload user for submitting an attempt
export interface SubmitAttemptPayload {
  moduleUnitId: number;
  studentId: number;
  questionUnitId: number;
  questionContentId: number;
  practiceMode: (typeof PRACTICE_MODES)[keyof typeof PRACTICE_MODES];
  isCorrect: boolean;
  timeTakenMs: number;
  usedHint: boolean;
  studentAnswer: StudentAnswer;
  attemptedAt: Date;
}

export interface SubmitAttemptResponse {
  moduleExpGained: number;
  studentExpGained: number;
}
