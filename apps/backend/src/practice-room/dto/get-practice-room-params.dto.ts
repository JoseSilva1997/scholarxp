// DTO for validating and transforming practice-room route params before they reach domain services.
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class GetPracticeRoomParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleUnitId!: number;
}
