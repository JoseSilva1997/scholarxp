// DTOs for daily-practice payloads; these implement shared contracts so the transport boundary stays synchronized with the frontend.
import type {
  CloseDailyPracticeSessionResponse,
  DailyPracticeProgress,
  DailyPracticeQuestionItem,
  DailyPracticeSelectionBucket,
  DailyPracticeTodayResponse,
  PracticeQuestionWithLatestAttempt,
  PracticeSessionType,
  SubmitDailyPracticeAttemptResponse,
} from '@scholarxp/api-contracts';
import type { Awards } from '@scholarxp/api-contracts';

export class DailyPracticeProgressDto implements DailyPracticeProgress {
  totalQuestions!: number;
  answeredQuestions!: number;
  completedAt!: string | null;
}

export class DailyPracticeQuestionItemDto implements DailyPracticeQuestionItem {
  questionUnitId!: number;
  moduleUnitId!: number;
  moduleUnitTitle!: string;
  position!: number;
  hasCorrectAttempt!: boolean | null;
  sourceBucket!: DailyPracticeSelectionBucket;
  coreQuestion!: PracticeQuestionWithLatestAttempt;
}

export class DailyPracticeTodayResponseDto implements DailyPracticeTodayResponse {
  setId!: string;
  moduleId!: number;
  practiceDateUtc!: string;
  sessionId!: string;
  sessionType?: PracticeSessionType;
  algorithmVersion!: DailyPracticeTodayResponse['algorithmVersion'];
  progress!: DailyPracticeProgressDto;
  questions!: DailyPracticeQuestionItemDto[];
  currentStreak?: number;
  highestStreak?: number;
}

export class SubmitDailyPracticeAttemptResponseDto implements SubmitDailyPracticeAttemptResponse {
  awards!: Awards;
  hasCorrectAttempt!: boolean;
  progress!: DailyPracticeProgressDto;
  encounterGrade!: SubmitDailyPracticeAttemptResponse['encounterGrade'];
  currentStreak?: number;
  highestStreak?: number;
}

export class CloseDailyPracticeSessionResponseDto implements CloseDailyPracticeSessionResponse {
  sessionId!: string;
  closedAt!: string;
  progress!: DailyPracticeProgressDto;
  setCompleted!: boolean;
}
