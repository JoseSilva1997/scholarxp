// DTO for validating optional practice-room query params so existing sessions can be resumed safely.
import {
  PracticeSessionTypeValues,
  type GetModuleUnitPracticeRoomQuery,
} from '@scholarxp/api-contracts';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class GetPracticeRoomQueryDto implements GetModuleUnitPracticeRoomQuery {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsIn(Object.values(PracticeSessionTypeValues))
  sessionType?: GetModuleUnitPracticeRoomQuery['sessionType'];
}
