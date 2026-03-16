// Validates completed-unit review params so retry quest triggers stay tied to a concrete module and lesson.
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class RecordCompletedUnitReviewParamsDto {
  // Module scope keeps authorization aligned with the module page where the review action is launched.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId!: number;

  // Lesson id identifies which completed unit was opened in read-only review mode.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleUnitId!: number;
}
