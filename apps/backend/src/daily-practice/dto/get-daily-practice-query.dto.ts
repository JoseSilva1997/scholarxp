// Validates optional daily-practice query params for resume flows.
import { IsOptional, IsUUID } from 'class-validator';
import type { GetTodayDailyPracticeQuery } from '@scholarxp/api-contracts';

export class GetDailyPracticeQueryDto implements GetTodayDailyPracticeQuery {
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
