// Role: groups daily-practice domain services so adaptive set generation can evolve behind one backend module boundary.
import { Module } from '@nestjs/common';
import { DailyPracticeCandidateReadService } from './daily-practice-candidate-read.service';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
import { DailyPracticeInterleavingService } from './daily-practice-interleaving.service';
import { DailyPracticeFsrsStateService } from './daily-practice-fsrs-state.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';
import { DailyPracticeSetSelectorService } from './daily-practice-set-selector.service';
import { DailyPracticeSetReadService } from './daily-practice-set-read.service';

@Module({
  providers: [
    DailyPracticeCandidateReadService,
    DailyPracticeFsrsGradeService,
    DailyPracticeInterleavingService,
    DailyPracticeFsrsStateService,
    DailyPracticeQuestionStateReadService,
    DailyPracticeSetSelectorService,
    DailyPracticeSetReadService,
  ],
  exports: [
    DailyPracticeCandidateReadService,
    DailyPracticeFsrsGradeService,
    DailyPracticeInterleavingService,
    DailyPracticeFsrsStateService,
    DailyPracticeQuestionStateReadService,
    DailyPracticeSetSelectorService,
    DailyPracticeSetReadService,
  ],
})
export class DailyPracticeModule {}
