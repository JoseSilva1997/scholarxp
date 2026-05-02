// Module role: bundles all XP-engine services and the rewards controller into a cohesive feature slice.
// Exports every service so sibling modules (e.g. daily-practice) can award and query XP without
// bypassing the engine's idempotency and ledger guarantees.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvatarModule } from '../db-entities/avatar/avatar.module';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleModule } from '../db-entities/user-module/user-module.module';
import { DailyLessonXpTrackService } from './daily-lesson-xp-track.service';
import { ExpAwardingService } from './exp-awarding.service';
import { ExpCalculationService } from './exp-calculation.service';
import { ExpQuestionContextService } from './exp-question-context.service';
import { ExpStreakService } from './exp-streak.service';
import { RewardsController } from './rewards.controller';

@Module({
  imports: [AuthModule, AvatarModule, UserModuleModule],
  controllers: [RewardsController],
  providers: [
    ExpLedgerService,
    DailyLessonXpTrackService,
    ExpAwardingService,
    ExpCalculationService,
    ExpQuestionContextService,
    ExpStreakService,
  ],
  exports: [
    ExpLedgerService,
    DailyLessonXpTrackService,
    ExpAwardingService,
    ExpCalculationService,
    ExpQuestionContextService,
    ExpStreakService,
  ],
})
export class ExpEngineModule {}
