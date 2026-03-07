// Module role: groups XP-engine infrastructure services so reward orchestration can be reused across domains.
import { Module } from '@nestjs/common';
import { AvatarModule } from '../db-entities/avatar/avatar.module';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { UserModuleModule } from '../db-entities/user-module/user-module.module';
import { PracticeRewardService } from './practice-reward.service';

@Module({
  imports: [AvatarModule, UserModuleModule],
  providers: [ExpLedgerService, PracticeRewardService],
  exports: [ExpLedgerService, PracticeRewardService],
})
export class ExpEngineModule {}
