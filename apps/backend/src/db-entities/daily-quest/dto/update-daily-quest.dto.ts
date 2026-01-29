import { PartialType } from '@nestjs/mapped-types';
import { CreateDailyQuestDto } from './create-daily-quest.dto';

export class UpdateDailyQuestDto extends PartialType(CreateDailyQuestDto) {}
