// Role: groups daily-practice domain services so adaptive set generation can evolve behind one backend module boundary.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserModuleModule } from '../db-entities/user-module/user-module.module';
import { ExpEngineModule } from '../exp-engine/exp-engine.module';
import { PracticeRoomModule } from '../practice-room/practice-room.module';
import { QuestsModule } from '../quests/quests.module';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';
import { DailyPracticeController } from './daily-practice.controller';
import { DailyPracticeEligibilityService } from './daily-practice-eligibility.service';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import { DailyPracticeMapper } from './daily-practice.mapper';
import { DailyPracticeMasteryExpService } from './daily-practice-mastery-exp.service';
import { DailyPracticeModuleProgressReadService } from './daily-practice-module-progress-read.service';
import { DailyPracticeReviewStateModule } from './daily-practice-review-state.module';
import { DailyPracticeService } from './daily-practice.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';
import { DailyPracticeVariantResolverService } from './daily-practice-variant-resolver.service';

@Module({
  imports: [
    AuthModule,
    ExpEngineModule,
    PracticeRoomModule,
    QuestsModule,
    UserModuleModule,
    DailyPracticeReviewStateModule,
  ],
  controllers: [DailyPracticeController],
  providers: [
    DailyPracticeCandidateReadService,
    DailyPracticeEligibilityService,
    DailyPracticeMapper,
    DailyPracticeInterleavingService,
    DailyPracticeMasteryExpService,
    DailyPracticeModuleProgressReadService,
    DailyPracticeService,
    DailyPracticeSetSelectorService,
    DailyPracticeSetReadService,
    DailyPracticeVariantResolverService,
  ],
  exports: [
    DailyPracticeCandidateReadService,
    DailyPracticeEligibilityService,
    DailyPracticeMapper,
    DailyPracticeInterleavingService,
    DailyPracticeMasteryExpService,
    DailyPracticeModuleProgressReadService,
    DailyPracticeService,
    DailyPracticeSetSelectorService,
    DailyPracticeSetReadService,
    DailyPracticeVariantResolverService,
  ],
})
export class DailyPracticeModule {}
