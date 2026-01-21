import { Module } from '@nestjs/common';
import { ModuleUnitService } from './module-unit.service';
import { ModuleUnitController } from './module-unit.controller';

@Module({
  controllers: [ModuleUnitController],
  providers: [ModuleUnitService],
})
export class ModuleUnitModule {}
