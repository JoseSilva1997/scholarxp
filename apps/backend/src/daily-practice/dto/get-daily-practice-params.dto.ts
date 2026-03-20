// Validates module-scoped daily-practice route params so controllers can trust numeric module ids.
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class GetDailyPracticeParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId: number;
}
