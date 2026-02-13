// DTO for validating optional practice-room query params so existing sessions can be resumed safely.
import type { GetModuleUnitPracticeRoomQuery } from '@scholarxp/api-contracts';
import { IsOptional, IsUUID } from 'class-validator';

export class GetPracticeRoomQueryDto implements GetModuleUnitPracticeRoomQuery {
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
