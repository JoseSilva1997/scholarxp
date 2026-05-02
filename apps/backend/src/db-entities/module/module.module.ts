// NestJS module for module CRUD and scheduled archive purging. Imports DailyPracticeModule
// so ModuleService can attach daily-practice status to module reads for student callers.
import { Module } from '@nestjs/common';
import { ModuleService } from './module.service';
import { ModuleController } from './module.controller';
import { AuthModule } from '../../auth/auth.module';
import { DailyPracticeModule } from '../../daily-practice/daily-practice.module';
import { ModulePurgeScheduleService } from './module-purge-schedule.service';

@Module({
  imports: [AuthModule, DailyPracticeModule],
  controllers: [ModuleController],
  providers: [ModuleService, ModulePurgeScheduleService],
})
export class ModuleModule {}
