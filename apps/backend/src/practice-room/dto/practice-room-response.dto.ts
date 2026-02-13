// DTOs for practice-room payloads; these implement shared contracts so frontend/backend stay synchronized.
import type {
  GenericAnswer,
  McqAnswer,
  ModuleUnitPracticeRoom,
  ModuleUnitPracticeRoomResponse,
  PracticeAttemptSnapshot,
  PracticeQuestion,
  PracticeQuestionUnit,
  PracticeQuestionWithLatestAttempt,
  StudentAnswer,
  TrueFalseAnswer,
} from '@scholarxp/api-contracts';
import type { QuestionData, questionType } from '@scholarxp/question-type-dtos';

export class ModuleUnitPracticeRoomResponseDto implements ModuleUnitPracticeRoomResponse {
  practiceRoom!: ModuleUnitPracticeRoomDto;
}

export class ModuleUnitPracticeRoomDto implements ModuleUnitPracticeRoom {
  sessionId!: string;
  moduleUnitId!: number;
  moduleUnitTitle!: string;
  questions!: PracticeQuestionUnitDto[];
}

export class PracticeQuestionUnitDto implements PracticeQuestionUnit {
  questionUnitId!: number;
  position!: number;
  hasCorrectAttempt!: boolean | null;
  coreQuestion!: PracticeQuestionWithLatestAttemptDto;
}

export class PracticeQuestionWithLatestAttemptDto implements PracticeQuestionWithLatestAttempt {
  questionId!: number;
  questionContent!: PracticeQuestionDto;
  lastAttempt!: PracticeAttemptSnapshotDto | null;
}

export class PracticeAttemptSnapshotDto implements PracticeAttemptSnapshot {
  studentAnswer!: StudentAnswer | null;
  isCorrect!: boolean | null;
}

export class PracticeQuestionDto implements PracticeQuestion {
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

// Backward-compatible aliases preserve old imports while consumers migrate to module-unit-scoped naming.
export {
  ModuleUnitPracticeRoomResponseDto as PracticeRoomResponseDto,
  ModuleUnitPracticeRoomDto as PracticeRoomDto,
  PracticeQuestionUnitDto as PracticeRoomQuestionUnitDto,
  PracticeQuestionWithLatestAttemptDto as QuestionWithLatestAttemptDto,
  PracticeAttemptSnapshotDto as PracticeRoomAttemptDto,
  PracticeQuestionDto as PracticeRoomQuestionDto,
};
