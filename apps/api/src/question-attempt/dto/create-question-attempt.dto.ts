import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateQuestionAttemptDto {
  @IsInt()
  @IsNotEmpty()
  moduleUnitId: number;

  @IsInt()
  @IsNotEmpty()
  studentId: number;

  @IsInt()
  @IsNotEmpty()
  questionId: number;

  @IsInt()
  @IsNotEmpty()
  contentId: number;

  @IsString()
  @IsNotEmpty()
  practiceMode: string;

  @IsBoolean()
  @IsNotEmpty()
  isCorrect: boolean;

  @IsInt()
  @IsNotEmpty()
  timeTakenMs: number;

  @IsInt()
  @IsNotEmpty()
  hintsUsed: number;

  @IsObject()
  @IsNotEmpty()
  studentAnswer: Record<string, any>;

  @IsDateString()
  @IsNotEmpty()
  attemptedAt: string;
}
