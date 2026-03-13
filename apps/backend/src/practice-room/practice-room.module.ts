import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExpEngineModule } from '../exp-engine/exp-engine.module';
import { QuestsModule } from '../quests/quests.module';
import { PracticeRoomController } from './practice-room.controller';
import { PracticeRoomMapper } from './practice-room.mapper';
import { PracticeRoomSessionSweepService } from './practice-room-session-sweep.service';
import { PracticeRoomService } from './practice-room.service';
import { StudentModuleUnitProgressService } from './student-module-unit-progress.service';

// This module isolates practice-room read orchestration and keeps route wiring explicit in one place.
@Module({
  imports: [AuthModule, ExpEngineModule, QuestsModule],
  controllers: [PracticeRoomController],
  providers: [
    PracticeRoomService,
    PracticeRoomSessionSweepService,
    PracticeRoomMapper,
    StudentModuleUnitProgressService,
  ],
  exports: [PracticeRoomService],
})
export class PracticeRoomModule {}
