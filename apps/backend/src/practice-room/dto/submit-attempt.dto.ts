// Validates submit-attempt requests against the shared practice-room contract.
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
  SubmitAttemptPayload,
} from '@scholarxp/api-contracts';

export class SubmitAttemptDto implements SubmitAttemptPayload {
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
