// Role: groups daily-practice domain services so adaptive set generation can evolve behind one backend module boundary.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PracticeRoomModule } from '../practice-room/practice-room.module';
import { QuestsModule } from '../quests/quests.module';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';
import { DailyPracticeController } from './daily-practice.controller';
import { DailyPracticeEligibilityService } from './daily-practice-eligibility.service';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import { DailyPracticeMapper } from './daily-practice.mapper';
import { DailyPracticeReviewStateModule } from './daily-practice-review-state.module';
import { DailyPracticeService } from './daily-practice.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';

@Module({
  imports: [
    AuthModule,
    PracticeRoomModule,
    QuestsModule,
    DailyPracticeReviewStateModule,
  ],
  controllers: [DailyPracticeController],
  providers: [
    DailyPracticeCandidateReadService,
    DailyPracticeEligibilityService,
    DailyPracticeMapper,
    DailyPracticeInterleavingService,
    DailyPracticeService,
    DailyPracticeSetSelectorService,
    DailyPracticeSetReadService,
  ],
  exports: [
    DailyPracticeCandidateReadService,
    DailyPracticeEligibilityService,
    DailyPracticeMapper,
    DailyPracticeInterleavingService,
    DailyPracticeService,
    DailyPracticeSetSelectorService,
    DailyPracticeSetReadService,
  ],
})
export class DailyPracticeModule {}
