import { Module } from '@nestjs/common';
import { QuestionAttemptService } from './question-attempt.service';
import { QuestionAttemptController } from './question-attempt.controller';

@Module({
  controllers: [QuestionAttemptController],
  providers: [QuestionAttemptService],
})
export class QuestionAttemptModule {}
