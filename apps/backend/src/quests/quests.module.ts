// Role: groups quest orchestration services and routes so quest generation/progress logic has a dedicated backend module.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DailyQuestModule } from '../db-entities/daily-quest/daily-quest.module';
import { DailyQuestController } from './daily-quest.controller';
import { QuestGenerationService } from './quest-generation.service';
import { QuestHistoryService } from './quest-history.service';

@Module({
  imports: [AuthModule, DailyQuestModule],
  controllers: [DailyQuestController],
  providers: [QuestGenerationService, QuestHistoryService],
  exports: [QuestGenerationService, QuestHistoryService],
})
export class QuestsModule {}
