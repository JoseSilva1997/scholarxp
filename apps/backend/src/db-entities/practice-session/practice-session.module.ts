// NestJS module providing PracticeSessionService; not exported as session creation is
// orchestrated entirely by the practice-room feature module.
import { Module } from '@nestjs/common';
import { PracticeSessionService } from './practice-session.service';

@Module({
  providers: [PracticeSessionService],
})
export class PracticeSessionModule {}
