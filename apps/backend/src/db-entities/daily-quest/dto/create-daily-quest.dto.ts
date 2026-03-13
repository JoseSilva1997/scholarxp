import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { QuestTypeValues, type QuestType } from '@scholarxp/api-contracts';

export class CreateDailyQuestDto {
  @IsInt()
  @IsOptional()
  moduleId: number | null;

  @IsInt()
  @IsOptional()
  moduleUnitId?: number;

  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsIn(Object.values(QuestTypeValues))
  @IsNotEmpty()
  type: QuestType;

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
