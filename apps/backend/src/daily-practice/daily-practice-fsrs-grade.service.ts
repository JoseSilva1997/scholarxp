// Role: maps ScholarXP daily-practice encounters to FSRS grades so grading rules stay centralized and testable.
import { Injectable } from '@nestjs/common';
import {
  FsrsReviewGradeValues,
  type FsrsReviewGrade,
} from '@scholarxp/api-contracts';
import { Rating, type Grade } from 'ts-fsrs';

type DailyPracticeGradeInput = {
  isCorrect: boolean;
  hintUnlocked: boolean;
  // Separates first-acquisition seeding from later review encounters: acquisition-struggle signals only influence grading at seed time because seeded stability/difficulty already carry that history into reviews.
  isSeeding: boolean;
  priorFailedInAcquisition: number;
  priorHintedInAcquisition: number;
  timeTakenMs: number;
};

type DailyPracticeV1FsrsGrade = Exclude<
  FsrsReviewGrade,
  typeof FsrsReviewGradeValues.easy
>;

// Threshold for "very slow first successful retrieval" on the seed path. Defined here because this is grade policy, not seed-state adjustment math.
const VERY_SLOW_SEED_THRESHOLD_MS = 30_000;

@Injectable()
export class DailyPracticeFsrsGradeService {
  // V1 rules:
  //   incorrect                                                 -> Again
  //   correct with a hint this encounter                        -> Hard
  //   seed with a prior failed or hinted acquisition attempt    -> Hard
  //   seed that took longer than VERY_SLOW_SEED_THRESHOLD_MS    -> Hard
  //   otherwise correct                                         -> Good
  // Review-path encounters (isSeeding=false) ignore acquisition history — that signal already lives in the seeded stability/difficulty.
  mapEncounterToGrade(
    input: DailyPracticeGradeInput,
  ): DailyPracticeV1FsrsGrade {
    if (!input.isCorrect) {
      return FsrsReviewGradeValues.again;
    }

    if (input.hintUnlocked) {
      return FsrsReviewGradeValues.hard;
    }

    if (input.isSeeding) {
      if (
        input.priorFailedInAcquisition > 0 ||
        input.priorHintedInAcquisition > 0 ||
        input.timeTakenMs > VERY_SLOW_SEED_THRESHOLD_MS
      ) {
        return FsrsReviewGradeValues.hard;
      }
    }

    return FsrsReviewGradeValues.good;
  }

  // V1 intentionally excludes Easy so daily-practice does not over-stretch intervals before we collect richer effort signals.
  toFsrsRating(grade: DailyPracticeV1FsrsGrade): Grade {
    if (grade === FsrsReviewGradeValues.again) {
      return Rating.Again as Grade;
    }

    if (grade === FsrsReviewGradeValues.hard) {
      return Rating.Hard as Grade;
    }

    return Rating.Good as Grade;
  }
}
