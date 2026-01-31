import { Module } from '@nestjs/common';
import { ModuleUnitService } from './module-unit.service';
import { ModuleUnitController } from './module-unit.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ModuleUnitController],
  providers: [ModuleUnitService],
})
export class ModuleUnitModule {}
