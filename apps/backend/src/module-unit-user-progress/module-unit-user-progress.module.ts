import { Module } from '@nestjs/common';
import { ModuleUnitUserProgressService } from './module-unit-user-progress.service';
import { ModuleUnitUserProgressController } from './module-unit-user-progress.controller';

@Module({
  controllers: [ModuleUnitUserProgressController],
  providers: [ModuleUnitUserProgressService],
})
export class ModuleUnitUserProgressModule {}
