// DTO for validating optional practice-room query params so existing sessions can be resumed safely.
import type { GetModuleUnitPracticeRoomQuery } from '@scholarxp/api-contracts';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class GetPracticeRoomQueryDto implements GetModuleUnitPracticeRoomQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sessionId?: number;
}
