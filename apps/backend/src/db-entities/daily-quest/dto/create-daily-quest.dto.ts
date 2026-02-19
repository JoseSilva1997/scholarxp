import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDailyQuestDto {
  @IsInt()
  @IsNotEmpty()
  moduleId: number;

  @IsInt()
  @IsOptional()
  moduleUnitId?: number;

  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsInt()
  @IsNotEmpty()
  expGranted: number;

  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;

  // Canonical UTC calendar day anchor used by generation and "today" reads.
  @IsDateString()
  @IsNotEmpty()
  questDateUtc: string;

  // Nullable completion timestamp; omitted for incomplete quests.
  @IsDateString()
  @IsOptional()
  completedAt?: string;

  // Optional override for backfills; default remains DB now().
  @IsDateString()
  @IsOptional()
  generatedAt?: string;
}
