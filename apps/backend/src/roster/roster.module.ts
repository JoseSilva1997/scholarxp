// Groups roster analytics behind one module boundary so enrollment/progress aggregation stays isolated from CRUD services.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DailyPracticeModule } from '../daily-practice/daily-practice.module';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';

@Module({
  imports: [AuthModule, DailyPracticeModule],
  controllers: [RosterController],
  providers: [RosterService],
  exports: [RosterService],
})
export class RosterModule {}
