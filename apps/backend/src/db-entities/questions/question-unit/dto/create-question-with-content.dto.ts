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
} from 'class-validator';
import { QUESTION_TYPES } from '@scholarxp/question-type-dtos';
import type { questionType, QuestionData } from '@scholarxp/question-type-dtos';
import { CreateQuestionPayload } from '@scholarxp/api-contracts';

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

  @IsNumber()
  @Min(0)
  @Max(100)
  difficultyScore: number;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}
