// Role: groups quest orchestration services and routes so quest generation/progress logic has a dedicated backend module.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvatarModule } from '../db-entities/avatar/avatar.module';
import { DailyQuestModule } from '../db-entities/daily-quest/daily-quest.module';
import { ExpEngineModule } from '../exp-engine/exp-engine.module';
import { DailyQuestController } from './daily-quest.controller';
import { QuestGenerationService } from './quest-generation.service';
import { QuestHistoryService } from './quest-history.service';
import { QuestProgressService } from './quest-progress.service';

@Module({
  imports: [AuthModule, AvatarModule, DailyQuestModule, ExpEngineModule],
  controllers: [DailyQuestController],
  providers: [
    QuestGenerationService,
    QuestHistoryService,
    QuestProgressService,
  ],
  exports: [QuestGenerationService, QuestHistoryService, QuestProgressService],
})
export class QuestsModule {}
