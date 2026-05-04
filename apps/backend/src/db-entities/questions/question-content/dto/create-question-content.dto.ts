// Input shape for creating a question content record. The type field must match a known
// question type, and questionData must conform to that type's Zod schema (validated in the service).
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsIn,
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

  @IsString()
  @IsIn(['human', 'ai-generated'])
  source: QuestionSource;

  @IsBoolean()
  // Default to live content when created; archiving is applied explicitly by author actions.
  isArchived: boolean = false;
}
