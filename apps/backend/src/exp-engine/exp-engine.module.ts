// Module role: groups XP-engine infrastructure services so reward orchestration can be reused across domains.
import { Module } from '@nestjs/common';
import { AvatarModule } from '../db-entities/avatar/avatar.module';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleModule } from '../db-entities/user-module/user-module.module';
import { ExpAwardingService } from './exp-awarding.service';
import { ExpCalculationService } from './exp-calculation.service';

@Module({
  imports: [AvatarModule, UserModuleModule],
  providers: [ExpLedgerService, ExpAwardingService, ExpCalculationService],
  exports: [ExpLedgerService, ExpAwardingService, ExpCalculationService],
})
export class ExpEngineModule {}
