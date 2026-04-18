// Role: verifies the encounter-to-grade mapping stays conservative so daily-practice reviews do not overestimate learner recall.
import { Rating } from 'ts-fsrs';
import { Test, type TestingModule } from '@nestjs/testing';
import { FsrsReviewGradeValues } from '@scholarxp/api-contracts';
import { DailyPracticeFsrsGradeService } from './daily-practice-fsrs-grade.service';

describe('DailyPracticeFsrsGradeService', () => {
  let service: DailyPracticeFsrsGradeService;

  const baseInput = {
    isCorrect: true,
    hintUnlocked: false,
    isSeeding: false,
    priorFailedInAcquisition: 0,
    priorHintedInAcquisition: 0,
    timeTakenMs: 5_000,
  } as const;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [DailyPracticeFsrsGradeService],
    }).compile();

    service = moduleRef.get(DailyPracticeFsrsGradeService);
  });

  it('maps incorrect encounters to again regardless of seeding', () => {
    expect(
      service.mapEncounterToGrade({
        ...baseInput,
        isCorrect: false,
      }),
    ).toBe(FsrsReviewGradeValues.again);
    expect(
      service.mapEncounterToGrade({
        ...baseInput,
        isCorrect: false,
        isSeeding: true,
      }),
    ).toBe(FsrsReviewGradeValues.again);
  });

  it('maps correct encounters with a hint this turn to hard', () => {
    expect(
      service.mapEncounterToGrade({
        ...baseInput,
        hintUnlocked: true,
      }),
    ).toBe(FsrsReviewGradeValues.hard);
  });

  it('maps clean correct review-path encounters to good even with prior acquisition struggle', () => {
    // Review-path: acquisition history is already folded into seeded stability and must not double-count per review.
    expect(
      service.mapEncounterToGrade({
        ...baseInput,
        isSeeding: false,
        priorFailedInAcquisition: 3,
        priorHintedInAcquisition: 2,
        timeTakenMs: 60_000,
      }),
    ).toBe(FsrsReviewGradeValues.good);
  });

  it('downgrades clean correct seeds to hard when any prior acquisition attempt failed', () => {
    expect(
      service.mapEncounterToGrade({
        ...baseInput,
        isSeeding: true,
        priorFailedInAcquisition: 1,
      }),
    ).toBe(FsrsReviewGradeValues.hard);
  });

  it('downgrades clean correct seeds to hard when acquisition required hints', () => {
    expect(
      service.mapEncounterToGrade({
        ...baseInput,
        isSeeding: true,
        priorHintedInAcquisition: 1,
      }),
    ).toBe(FsrsReviewGradeValues.hard);
  });

  it('downgrades clean correct seeds to hard when the first successful retrieval was very slow', () => {
    expect(
      service.mapEncounterToGrade({
        ...baseInput,
        isSeeding: true,
        timeTakenMs: 30_001,
      }),
    ).toBe(FsrsReviewGradeValues.hard);
  });

  it('maps clean correct seeds with no acquisition struggle to good', () => {
    expect(
      service.mapEncounterToGrade({
        ...baseInput,
        isSeeding: true,
        timeTakenMs: 8_000,
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
