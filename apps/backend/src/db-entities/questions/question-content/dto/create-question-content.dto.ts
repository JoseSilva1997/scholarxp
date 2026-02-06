import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { QUESTION_TYPES } from '@scholarxp/question-type-dtos';
import type { questionType, QuestionData } from '@scholarxp/question-type-dtos';
import type { QuestionSource } from '@scholarxp/api-contracts';
import { QuestionContentPayload } from '@scholarxp/api-contracts';

export class CreateQuestionContentDto implements QuestionContentPayload {
  @IsIn(QUESTION_TYPES)
  @IsNotEmpty()
  type: questionType;

  @IsString()
  @IsNotEmpty()
  questionStem: string;

  @IsObject()
  @IsNotEmpty()
  questionData: QuestionData;

  @IsInt()
  @IsNotEmpty()
  questionUnitId: number;

  @IsOptional()
  @IsBoolean()
  isCore?: boolean;

  @IsString()
  @IsOptional()
  hint?: string | null;

  // Keep a stable default for direct content creation paths as well.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  difficultyScore: number = 0.5;

  @IsString()
  @IsIn(['human', 'ai-generated'])
  source: QuestionSource;

  @IsBoolean()
  // Default to live content when created; archiving is applied explicitly by author actions.
  isArchived: boolean = false;
}
