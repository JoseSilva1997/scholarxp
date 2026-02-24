import { Module } from '@nestjs/common';
import { PracticeSessionService } from './practice-session.service';

@Module({
  providers: [PracticeSessionService],
})
export class PracticeSessionModule {}
