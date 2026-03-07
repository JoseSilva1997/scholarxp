// Module role: groups XP-engine infrastructure services so reward orchestration can be reused across domains.
import { Module } from '@nestjs/common';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';

@Module({
  providers: [ExpLedgerService],
  exports: [ExpLedgerService],
})
export class ExpEngineModule {}
