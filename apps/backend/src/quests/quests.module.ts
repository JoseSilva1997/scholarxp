// Role: groups quest orchestration services and routes so quest generation/progress logic has a dedicated backend module.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DailyPracticeCandidateReadService } from '../daily-practice/daily-practice-candidate-read.service';
import { DailyPracticeEligibilityService } from '../daily-practice/daily-practice-eligibility.service';
import { DailyPracticeQuestionStateReadService } from '../daily-practice/daily-practice-question-state-read.service';
import { DailyPracticeSetReadService } from '../daily-practice/daily-practice-set-read.service';
import { DailyPracticeSetSelectorService } from '../daily-practice/daily-practice-set-selector.service';
import { AvatarModule } from '../db-entities/avatar/avatar.module';
import { DailyQuestModule } from '../db-entities/daily-quest/daily-quest.module';
import { ExpEngineModule } from '../exp-engine/exp-engine.module';
import { DailyQuestController } from './daily-quest.controller';
import { QuestDailyPracticeAvailabilityService } from './quest-daily-practice-availability.service';
import { QuestGenerationBatchService } from './quest-generation-batch.service';
import { QuestGenerationService } from './quest-generation.service';
import { QuestGenerationStartupService } from './quest-generation-startup.service';
import { QuestHistoryService } from './quest-history.service';
import { QuestProgressService } from './quest-progress.service';
import { QuestStreakService } from './quest-streak.service';

@Module({
  imports: [AuthModule, AvatarModule, DailyQuestModule, ExpEngineModule],
  controllers: [DailyQuestController],
  providers: [
    DailyPracticeCandidateReadService,
    DailyPracticeEligibilityService,
    DailyPracticeQuestionStateReadService,
    DailyPracticeSetReadService,
    DailyPracticeSetSelectorService,
    QuestGenerationBatchService,
    QuestDailyPracticeAvailabilityService,
    QuestGenerationService,
    QuestGenerationStartupService,
    QuestHistoryService,
    QuestProgressService,
    QuestStreakService,
  ],
  // These services are exported so cross-cutting modules (e.g. practice-room, daily-practice) can trigger quest
  // progress events without importing the full quests domain directly into their own service files.
  exports: [
    QuestGenerationBatchService,
    QuestGenerationService,
    QuestHistoryService,
    QuestProgressService,
    QuestStreakService,
  ],
})
export class QuestsModule {}
