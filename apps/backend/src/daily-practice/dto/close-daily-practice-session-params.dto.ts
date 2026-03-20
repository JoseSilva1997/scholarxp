// Validates module-scoped daily-practice close-session route params.
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class CloseDailyPracticeSessionParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId: number;

  @IsUUID()
  sessionId: string;
}
