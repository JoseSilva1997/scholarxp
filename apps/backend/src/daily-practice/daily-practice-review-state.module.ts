// Role: shares the adaptive question-state services between daily-practice and lesson practice so all qualifying encounters feed one learner-state model.
import { Module } from '@nestjs/common';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';
import { DailyPracticeFsrsPolicyService } from './daily-practice-fsrs-policy.service';
import { DailyPracticeFsrsStateService } from './daily-practice-fsrs-state.service';
import { DailyPracticeQuestionStateReadService } from './daily-practice-question-state-read.service';

// Keeping the review-state services in a small shared module avoids a cross-domain module cycle while preserving one canonical FSRS update path.
@Module({
  providers: [
    DailyPracticeFsrsGradeService,
    DailyPracticeFsrsPolicyService,
    DailyPracticeFsrsStateService,
    DailyPracticeQuestionStateReadService,
  ],
  exports: [
    DailyPracticeFsrsGradeService,
    DailyPracticeFsrsPolicyService,
    DailyPracticeFsrsStateService,
    DailyPracticeQuestionStateReadService,
  ],
})
export class DailyPracticeReviewStateModule {}
