import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PracticeRoomController } from './practice-room.controller';
import { PracticeRoomMapper } from './practice-room.mapper';
import { PracticeRoomService } from './practice-room.service';

// This module isolates practice-room read orchestration and keeps route wiring explicit in one place.
@Module({
  imports: [AuthModule],
  controllers: [PracticeRoomController],
  providers: [PracticeRoomService, PracticeRoomMapper],
  exports: [PracticeRoomService],
})
export class PracticeRoomModule {}
