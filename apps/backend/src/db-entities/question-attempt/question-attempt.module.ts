// NestJS module providing QuestionAttemptService to the practice-room feature module
// for recording individual question results within a session.
import { Module } from '@nestjs/common';
import { QuestionAttemptService } from './question-attempt.service';
@Module({
  providers: [QuestionAttemptService],
  exports: [QuestionAttemptService],
})
export class QuestionAttemptModule {}
