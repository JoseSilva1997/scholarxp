// Groups roster analytics behind one module boundary so enrollment/progress aggregation stays isolated from CRUD services.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DailyPracticeModule } from '../daily-practice/daily-practice.module';
import { RosterController } from './roster.controller';
import { RosterLessonAnalyticsService } from './roster-lesson-analytics.service';
import { RosterModuleAnalyticsService } from './roster-module-analytics.service';
import { RosterService } from './roster.service';
import { RosterStudentAnalyticsService } from './roster-student-analytics.service';

@Module({
  imports: [AuthModule, DailyPracticeModule],
  controllers: [RosterController],
  providers: [
    RosterService,
    RosterModuleAnalyticsService,
    RosterStudentAnalyticsService,
    RosterLessonAnalyticsService,
  ],
  exports: [RosterService],
})
export class RosterModule {}
