import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsUUID,
} from 'class-validator';

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

  @IsUUID()
  sessionId: string;

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
  studentAnswer: Record<string, unknown>;

  @IsDateString()
  @IsNotEmpty()
  attemptedAt: string;
}
