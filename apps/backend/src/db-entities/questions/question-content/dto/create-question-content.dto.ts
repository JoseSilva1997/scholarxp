import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';
import { QUESTION_TYPES } from '@scholarxp/question-type-dtos';
import type { questionType, QuestionData } from '@scholarxp/question-type-dtos';

export class CreateQuestionContentDto {
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

  @IsNumber()
  @IsNotEmpty()
  difficultyScore: number;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}
