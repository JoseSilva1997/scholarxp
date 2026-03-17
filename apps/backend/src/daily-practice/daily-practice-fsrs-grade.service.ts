// Role: maps ScholarXP daily-practice encounters to FSRS grades so grading rules stay centralized and testable.
import { Injectable } from '@nestjs/common';
import {
  FsrsReviewGradeValues,
  type FsrsReviewGrade,
} from '@scholarxp/api-contracts';
import { Rating, type Grade } from 'ts-fsrs';

type DailyPracticeGradeInput = {
  firstAttemptCorrect: boolean;
  hintUnlocked: boolean;
};

type DailyPracticeV1FsrsGrade = Exclude<
  FsrsReviewGrade,
  typeof FsrsReviewGradeValues.easy
>;

@Injectable()
export class DailyPracticeFsrsGradeService {
  // V1 keeps the mapping intentionally conservative: incorrect => Again, hinted correct => Hard, clean correct => Good.
  mapEncounterToGrade(
    input: DailyPracticeGradeInput,
  ): DailyPracticeV1FsrsGrade {
    if (!input.firstAttemptCorrect) {
      return FsrsReviewGradeValues.again;
    }

    if (input.hintUnlocked) {
      return FsrsReviewGradeValues.hard;
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
