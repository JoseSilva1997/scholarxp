// Wires the practice-room bounded context: registers every collaborating service under one
// NestJS module and exports the subset consumed by adjacent modules (e.g. daily-practice).
// Depends on ExpEngineModule for XP side-effects and QuestsModule for quest-progress hooks.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DailyPracticeReviewStateModule } from '../daily-practice/daily-practice-review-state.module';
import { ExpEngineModule } from '../exp-engine/exp-engine.module';
import { QuestsModule } from '../quests/quests.module';
import { PracticeRoomController } from './practice-room.controller';
import { PracticeRoomAttemptService } from './practice-room-attempt.service';
import { PracticeRoomMapper } from './practice-room.mapper';
import { PracticeRoomReadService } from './practice-room-read.service';
import { PracticeRoomSessionService } from './practice-session.service';
import { PracticeRoomSessionSweepService } from './practice-room-session-sweep.service';
import { PracticeRoomService } from './practice-room.service';
import { StudentModuleUnitProgressService } from './student-module-unit-progress.service';

@Module({
  imports: [
    AuthModule,
    ExpEngineModule,
    QuestsModule,
    DailyPracticeReviewStateModule,
  ],
  controllers: [PracticeRoomController],
  providers: [
    PracticeRoomService,
    PracticeRoomAttemptService,
    PracticeRoomSessionSweepService,
    PracticeRoomMapper,
    PracticeRoomReadService,
    PracticeRoomSessionService,
    StudentModuleUnitProgressService,
  ],
  exports: [
    PracticeRoomService,
    PracticeRoomAttemptService,
    PracticeRoomMapper,
    PracticeRoomSessionService,
  ],
})
export class PracticeRoomModule {}
