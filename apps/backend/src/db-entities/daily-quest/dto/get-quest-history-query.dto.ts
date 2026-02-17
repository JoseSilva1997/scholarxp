// Validates quest-history pagination query params so day-window reads stay bounded and deterministic.
import { QuestHistoryQuery } from '@scholarxp/api-contracts';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetQuestHistoryQueryDto implements QuestHistoryQuery {
  // Limit is capped to keep one request from loading excessive quest history.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dayLimit?: number;

  // Offset is day-based (not row-based) so each page cleanly represents whole UTC days.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dayOffset?: number;
}
