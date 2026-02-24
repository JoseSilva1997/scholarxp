import { Module } from '@nestjs/common';
import { QuestionAttemptService } from './question-attempt.service';
@Module({
  providers: [QuestionAttemptService],
  exports: [QuestionAttemptService],
})
export class QuestionAttemptModule {}
