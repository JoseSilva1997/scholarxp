// Role: groups daily-practice domain services so adaptive set generation can evolve behind one backend module boundary.
import { Module } from '@nestjs/common';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';

@Module({
  providers: [
    DailyPracticeCandidateReadService,
    DailyPracticeQuestionStateReadService,
    DailyPracticeSetReadService,
  ],
  exports: [
    DailyPracticeCandidateReadService,
    DailyPracticeQuestionStateReadService,
    DailyPracticeSetReadService,
  ],
})
export class DailyPracticeModule {}
