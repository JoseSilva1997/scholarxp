import { Module } from '@nestjs/common';
import { AvatarModule } from '../db-entities/avatar/avatar.module';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleModule } from '../db-entities/user-module/user-module.module';
import { ExpAwardingService } from './exp-awarding.service';
import { ExpCalculationService } from './exp-calculation.service';
import { ExpQuestionContextService } from './exp-question-context.service';
import { ExpStreakService } from './exp-streak.service';

@Module({
  imports: [AvatarModule, UserModuleModule],
  providers: [
    ExpLedgerService,
    ExpAwardingService,
    ExpCalculationService,
    ExpQuestionContextService,
    ExpStreakService,
  ],
  exports: [
    ExpLedgerService,
    ExpAwardingService,
    ExpCalculationService,
    ExpQuestionContextService,
    ExpStreakService,
  ],
})
export class ExpEngineModule {}
