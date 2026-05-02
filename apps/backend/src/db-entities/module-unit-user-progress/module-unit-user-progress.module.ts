// NestJS module providing ModuleUnitUserProgressService. Not exported; consumed internally by the practice flow.
import { Module } from '@nestjs/common';
import { ModuleUnitUserProgressService } from './module-unit-user-progress.service';

@Module({
  providers: [ModuleUnitUserProgressService],
})
export class ModuleUnitUserProgressModule {}
