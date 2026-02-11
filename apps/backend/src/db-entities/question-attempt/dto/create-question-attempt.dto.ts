import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
} from 'class-validator';
import type { PracticeMode } from '@scholarxp/constants';

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

  @IsInt()
  sessionId: number;

  @IsString()
  @IsNotEmpty()
  practiceMode: PracticeMode;

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
