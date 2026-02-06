// DTO for creating a variant plus its content for a question unit.
import { IsNotEmpty, IsObject, IsOptional, IsString, Max, Min, IsIn, IsNumber, IsBoolean } from 'class-validator';
import { QUESTION_TYPES } from '@scholarxp/question-type-dtos';
import type { questionType, QuestionData } from '@scholarxp/question-type-dtos';
import type { CreateVariantPayload, QuestionSource } from '@scholarxp/api-contracts';

export class CreateVariantWithContentDto implements CreateVariantPayload {
  @IsString()
  @IsNotEmpty()
  variantLabel: string;

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
  @IsIn(['human', 'ai-generated'])
  source: QuestionSource;

  @IsBoolean()
  // New variants are live by default; archiving is explicit.
  isArchived: boolean = false;
}
