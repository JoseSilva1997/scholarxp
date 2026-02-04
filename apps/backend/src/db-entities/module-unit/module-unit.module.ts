import { Module } from '@nestjs/common';
import { ModuleUnitService } from './module-unit.service';
import { ModuleUnitController } from './module-unit.controller';
import { AuthModule } from '../../auth/auth.module';
import { QuestionUnitModule } from '../questions/question-unit/question-unit.module';

@Module({
  imports: [AuthModule, QuestionUnitModule],
  controllers: [ModuleUnitController],
  providers: [ModuleUnitService],
})
export class ModuleUnitModule {}
