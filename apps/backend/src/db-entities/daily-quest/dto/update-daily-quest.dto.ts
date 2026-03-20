// Keeps PartialType behavior while making the optional update shape explicit to TypeScript across service callsites.
import { PartialType } from '@nestjs/mapped-types';
import type { QuestType } from '@scholarxp/api-contracts';
import { CreateDailyQuestDto } from './create-daily-quest.dto';

export class UpdateDailyQuestDto extends PartialType(CreateDailyQuestDto) {
  moduleId?: number | null;
  moduleUnitId?: number;
  userId?: number;
  type?: QuestType;
  expGranted?: number;
  isCompleted?: boolean;
  questDateUtc?: string;
  completedAt?: string;
  generatedAt?: string;
}
