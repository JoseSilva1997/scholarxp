// Validates module-scoped roster route params so controllers can trust numeric IDs from the URL.
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class RosterModuleParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId: number;
}

export class RosterStudentParamsDto extends RosterModuleParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId: number;
}

export class RosterLessonParamsDto extends RosterModuleParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleUnitId: number;
}
