import { Module } from '@nestjs/common';
import { DailyQuestService } from './daily-quest.service';
import { DailyQuestController } from './daily-quest.controller';

@Module({
  controllers: [DailyQuestController],
  providers: [DailyQuestService],
})
export class DailyQuestModule {}
