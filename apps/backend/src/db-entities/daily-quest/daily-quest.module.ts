import { Module } from '@nestjs/common';
import { DailyQuestService } from './daily-quest.service';

@Module({
  providers: [DailyQuestService],
  exports: [DailyQuestService],
})
export class DailyQuestModule {}
