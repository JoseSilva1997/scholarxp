// Role: verifies the encounter-to-grade mapping stays conservative so daily-practice reviews do not overestimate learner recall.
import { Rating } from 'ts-fsrs';
import { Test, type TestingModule } from '@nestjs/testing';
import { FsrsReviewGradeValues } from '@scholarxp/api-contracts';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';

describe('DailyPracticeFsrsGradeService', () => {
  let service: DailyPracticeFsrsGradeService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [DailyPracticeFsrsGradeService],
    }).compile();

    service = moduleRef.get(DailyPracticeFsrsGradeService);
  });

  it('maps incorrect first attempts to again', () => {
    expect(
      service.mapEncounterToGrade({
        firstAttemptCorrect: false,
        hintUnlocked: false,
      }),
    ).toBe(FsrsReviewGradeValues.again);
  });

  it('maps hinted correct first attempts to hard', () => {
    expect(
      service.mapEncounterToGrade({
        firstAttemptCorrect: true,
        hintUnlocked: true,
      }),
    ).toBe(FsrsReviewGradeValues.hard);
  });

  it('maps clean correct first attempts to good', () => {
    expect(
      service.mapEncounterToGrade({
        firstAttemptCorrect: true,
        hintUnlocked: false,
      }),
    ).toBe(FsrsReviewGradeValues.good);
  });

  it('bridges contract grades to ts-fsrs ratings', () => {
    expect(service.toFsrsRating(FsrsReviewGradeValues.again)).toBe(
      Rating.Again,
    );
    expect(service.toFsrsRating(FsrsReviewGradeValues.hard)).toBe(Rating.Hard);
    expect(service.toFsrsRating(FsrsReviewGradeValues.good)).toBe(Rating.Good);
  });
});
