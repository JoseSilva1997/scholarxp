// NestJS feature module for the profile domain. Imports cross-cutting feature modules whose services
// are consumed by the role-specific profile aggregators (quests, XP engine, daily practice, auth).
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DailyPracticeModule } from '../daily-practice/daily-practice.module';
import { ExpEngineModule } from '../exp-engine/exp-engine.module';
import { QuestsModule } from '../quests/quests.module';
import { ProfileController } from './profile.controller';
import { StudentProfileService } from './student-profile.service';
import { TutorProfileService } from './tutor-profile.service';

@Module({
  imports: [AuthModule, QuestsModule, ExpEngineModule, DailyPracticeModule],
  controllers: [ProfileController],
  providers: [StudentProfileService, TutorProfileService],
})
export class ProfileModule {}
