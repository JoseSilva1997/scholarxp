import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateQuestionContentDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  questionStem: string;

  @IsObject()
  @IsNotEmpty()
  questionData: Record<string, any>;

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
