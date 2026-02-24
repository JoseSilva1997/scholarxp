import { Module } from '@nestjs/common';
import { ModuleUnitUserProgressService } from './module-unit-user-progress.service';

@Module({
  providers: [ModuleUnitUserProgressService],
})
export class ModuleUnitUserProgressModule {}
