// Validates daily-practice attempt submissions against the shared contract while reusing the existing practice answer shape.
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsUUID,
  Min,
} from 'class-validator';
import type {
  StudentAnswer,
  SubmitDailyPracticeAttemptPayload,
} from '@scholarxp/api-contracts';

export class SubmitDailyPracticeAttemptDto implements SubmitDailyPracticeAttemptPayload {
  @IsUUID()
  setId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleUnitId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  questionUnitId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  questionContentId: number;

  @IsUUID()
  sessionId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  timeTakenMs: number;

  @IsBoolean()
  hintUnlocked: boolean;

  @IsObject()
  @IsNotEmpty()
  studentAnswer: StudentAnswer;
}
