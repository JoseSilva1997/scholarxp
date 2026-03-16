// Validates the module-scoped daily-revision quest trigger params before they reach quest progress orchestration.
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class RecordDailyRevisionParamsDto {
  // Module scope is required so shared authorization can confirm the caller belongs to the module they clicked from.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId!: number;
}
