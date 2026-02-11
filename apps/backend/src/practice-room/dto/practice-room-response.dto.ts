// DTOs for practice-room payloads; these implement shared contracts so frontend/backend stay synchronized.
import type {
  GenericAnswer,
  McqAnswer,
  PracticeRoom,
  PracticeRoomAttempt,
  PracticeRoomQuestion,
  PracticeRoomQuestionUnit,
  PracticeRoomResponse,
  QuestionWithLatestAttempt,
  StudentAnswer,
  TrueFalseAnswer,
} from '@scholarxp/api-contracts';
import type { QuestionData, questionType } from '@scholarxp/question-type-dtos';

export class PracticeRoomResponseDto implements PracticeRoomResponse {
  practiceRoom!: PracticeRoomDto;
}

export class PracticeRoomDto implements PracticeRoom {
  sessionId!: number;
  moduleUnitId!: number;
  moduleUnitTitle!: string;
  questions!: PracticeRoomQuestionUnitDto[];
}

export class PracticeRoomQuestionUnitDto implements PracticeRoomQuestionUnit {
  questionUnitId!: number;
  position!: number;
  hasCorrectAttempt!: boolean | null;
  coreQuestion!: QuestionWithLatestAttemptDto;
  variants!: QuestionWithLatestAttemptDto[];
}

export class QuestionWithLatestAttemptDto implements QuestionWithLatestAttempt {
  questionId!: number;
  questionContent!: PracticeRoomQuestionDto;
  lastAttempt!: PracticeRoomAttemptDto | null;
}

export class PracticeRoomAttemptDto implements PracticeRoomAttempt {
  studentAnswer!: StudentAnswer | null;
  isCorrect!: boolean | null;
}

export class PracticeRoomQuestionDto implements PracticeRoomQuestion {
  id!: number;
  type!: questionType;
  questionStem!: string;
  questionData!: QuestionData;
  hint!: string | null;
  difficultyScore!: number;
}

// Concrete answer DTOs keep typed parity with the shared union and simplify future extension points.
export class McqAnswerDto implements McqAnswer {
  selectedOptionIndex!: number;
}

export class TrueFalseAnswerDto implements TrueFalseAnswer {
  selectedOptionIndex!: number;
}

export class GenericAnswerDto implements GenericAnswer {
  data!: Record<string, unknown>;
}
