// DTO for creating a question unit plus its core content in one call; variants are handled separately.
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  IsIn,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { QUESTION_TYPES } from '@scholarxp/question-type-dtos';
import type { questionType, QuestionData } from '@scholarxp/question-type-dtos';
import type {
  CreateQuestionPayload,
  QuestionSource,
} from '@scholarxp/api-contracts';

export class CreateQuestionWithContentDto implements CreateQuestionPayload {
  @IsOptional()
  @IsInt()
  questionGroupId?: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  questionStem: string;

  @IsIn(QUESTION_TYPES)
  type: questionType;

  @IsObject()
  @IsNotEmpty()
  questionData: QuestionData;

  @IsOptional()
  @IsString()
  hint?: string | null;

  // New content starts at medium difficulty and is adjusted by attempt analytics later.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  difficultyScore: number = 0.5;

  @IsString()
  @IsIn(['human', 'ai-generated'])
  source: QuestionSource;

  @IsBoolean()
  // Treat new questions as live unless explicitly archived.
  isArchived: boolean = false;
}
