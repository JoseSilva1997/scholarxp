import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

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
