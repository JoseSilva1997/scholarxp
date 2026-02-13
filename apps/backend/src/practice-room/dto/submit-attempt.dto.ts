// Validates submit-attempt requests against the shared practice-room contract.
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsUUID,
  Min,
} from 'class-validator';
import { PRACTICE_MODES, type PracticeMode } from '@scholarxp/constants';
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

  @IsIn(Object.values(PRACTICE_MODES))
  practiceMode: PracticeMode;

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
