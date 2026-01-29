import { Module } from '@nestjs/common';
import { PracticeSessionService } from './practice-session.service';
import { PracticeSessionController } from './practice-session.controller';

@Module({
  controllers: [PracticeSessionController],
  providers: [PracticeSessionService],
})
export class PracticeSessionModule {}
