// Role: maps daily-practice reads into shared API DTOs so controller/service code can stay orchestration-focused.
import { Injectable } from '@nestjs/common';
import type {
  Awards,
  PracticeSessionType,
  StudentAnswer,
} from '@scholarxp/api-contracts';
import type { QuestionData, questionType } from '@scholarxp/question-type-dtos';
import {
  CloseDailyPracticeSessionResponseDto,
  DailyPracticeProgressDto,
  DailyPracticeQuestionItemDto,
  DailyPracticeTodayResponseDto,
  SubmitDailyPracticeAttemptResponseDto,
} from './dto/daily-practice-response.dto';

type DailyPracticeAttemptSnapshot = {
  studentAnswer: unknown;
  isCorrect: boolean;
};

type BuildTodayResponseInput = {
  setId: string;
  moduleId: number;
  practiceDateUtc: Date;
  sessionId: string;
  sessionType: PracticeSessionType;
  algorithmVersion: string;
  progress: {
    totalQuestions: number;
    answeredQuestions: number;
    completedAt: Date | null;
  };
  questions: Array<{
    questionUnitId: number;
    moduleUnitId: number;
    moduleUnitTitle: string;
    position: number;
    hasCorrectAttempt: boolean | null;
    sourceBucket: DailyPracticeQuestionItemDto['sourceBucket'];
    coreQuestion: {
      questionId: number;
      questionContent: {
        id: number;
        type: string;
        questionStem: string;
        questionData: QuestionData;
        hint: string | null;
        difficultyScore: number;
      };
      lastAttempt: DailyPracticeAttemptSnapshot | null;
    };
  }>;
};

@Injectable()
export class DailyPracticeMapper {
  // Response mapping is centralized here so endpoint contracts can evolve without spreading ISO/date and question-shape rules across services.
  buildTodayResponse(
    input: BuildTodayResponseInput,
  ): DailyPracticeTodayResponseDto {
    const response = new DailyPracticeTodayResponseDto();
    response.setId = input.setId;
    response.moduleId = input.moduleId;
    response.practiceDateUtc = input.practiceDateUtc.toISOString();
    response.sessionId = input.sessionId;
    response.sessionType = input.sessionType;
    response.algorithmVersion =
      input.algorithmVersion as DailyPracticeTodayResponseDto['algorithmVersion'];
    response.progress = this.buildProgressDto(input.progress);
    response.questions = input.questions.map((question) =>
      this.buildQuestionItemDto(question),
    );

    return response;
  }

  // Submit responses intentionally return zero-or-more awards and progress only, keeping FSRS internals private to the backend.
  buildSubmitResponse(input: {
    awards: Awards;
    hasCorrectAttempt: boolean;
    progress: {
      totalQuestions: number;
      answeredQuestions: number;
      completedAt: Date | null;
    };
    encounterGrade: SubmitDailyPracticeAttemptResponseDto['encounterGrade'];
  }): SubmitDailyPracticeAttemptResponseDto {
    const response = new SubmitDailyPracticeAttemptResponseDto();
    response.awards = input.awards;
    response.hasCorrectAttempt = input.hasCorrectAttempt;
    response.progress = this.buildProgressDto(input.progress);
    response.encounterGrade = input.encounterGrade;

    return response;
  }

  // Close responses stay idempotent and progress-aware so navigation/unload hooks can render the latest completion state immediately.
  buildCloseResponse(input: {
    sessionId: string;
    closedAt: string;
    progress: {
      totalQuestions: number;
      answeredQuestions: number;
      completedAt: Date | null;
    };
  }): CloseDailyPracticeSessionResponseDto {
    const response = new CloseDailyPracticeSessionResponseDto();
    response.sessionId = input.sessionId;
    response.closedAt = input.closedAt;
    response.progress = this.buildProgressDto(input.progress);
    response.setCompleted = input.progress.completedAt !== null;

    return response;
  }

  private buildProgressDto(progress: {
    totalQuestions: number;
    answeredQuestions: number;
    completedAt: Date | null;
  }): DailyPracticeProgressDto {
    const dto = new DailyPracticeProgressDto();
    dto.totalQuestions = progress.totalQuestions;
    dto.answeredQuestions = progress.answeredQuestions;
    dto.completedAt = progress.completedAt?.toISOString() ?? null;

    return dto;
  }

  private buildQuestionItemDto(
    question: BuildTodayResponseInput['questions'][number],
  ): DailyPracticeQuestionItemDto {
    const dto = new DailyPracticeQuestionItemDto();
    dto.questionUnitId = question.questionUnitId;
    dto.moduleUnitId = question.moduleUnitId;
    dto.moduleUnitTitle = question.moduleUnitTitle;
    dto.position = question.position;
    dto.hasCorrectAttempt = question.hasCorrectAttempt;
    dto.sourceBucket = question.sourceBucket;
    dto.coreQuestion = {
      questionId: question.coreQuestion.questionId,
      questionContent: {
        id: question.coreQuestion.questionContent.id,
        type: question.coreQuestion.questionContent.type as questionType,
        questionStem: question.coreQuestion.questionContent.questionStem,
        questionData: question.coreQuestion.questionContent.questionData,
        hint: question.coreQuestion.questionContent.hint,
        difficultyScore: question.coreQuestion.questionContent.difficultyScore,
      },
      lastAttempt: question.coreQuestion.lastAttempt
        ? {
            studentAnswer: question.coreQuestion.lastAttempt
              .studentAnswer as StudentAnswer,
            isCorrect: question.coreQuestion.lastAttempt.isCorrect,
          }
        : null,
    };

    return dto;
  }
}
