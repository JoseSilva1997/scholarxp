// DTO for creating a variant plus its content for a question unit.
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min, IsIn, IsNumber } from 'class-validator';

type QuestionType = 'mcq' | 'trueFalse';

export class CreateVariantWithContentDto {
  @IsString()
  @IsNotEmpty()
  variantLabel: string;

  @IsString()
  @IsNotEmpty()
  questionStem: string;

  @IsIn(['mcq', 'trueFalse'])
  questionType: QuestionType;

  @IsObject()
  @IsNotEmpty()
  questionData: Record<string, unknown>;

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
