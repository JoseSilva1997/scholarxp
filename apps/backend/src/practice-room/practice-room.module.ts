import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvatarModule } from '../db-entities/avatar/avatar.module';
import { UserModuleModule } from '../db-entities/user-module/user-module.module';
import { PracticeRoomController } from './practice-room.controller';
import { PracticeRoomMapper } from './practice-room.mapper';
import { PracticeRoomService } from './practice-room.service';
import { StudentModuleUnitProgressService } from './student-module-unit-progress.service';

// This module isolates practice-room read orchestration and keeps route wiring explicit in one place.
@Module({
  imports: [AuthModule, AvatarModule, UserModuleModule],
  controllers: [PracticeRoomController],
  providers: [
    PracticeRoomService,
    PracticeRoomMapper,
    StudentModuleUnitProgressService,
  ],
  exports: [PracticeRoomService],
})
export class PracticeRoomModule {}
