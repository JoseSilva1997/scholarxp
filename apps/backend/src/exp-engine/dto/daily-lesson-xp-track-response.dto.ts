// DTO role: keeps the standalone daily lesson XP track response synchronized with the shared rewards contract.
import type {
  DailyLessonXpTrackResponse,
  DailyLessonXpTrackStep,
} from '@scholarxp/api-contracts';

export class DailyLessonXpTrackStepDto implements DailyLessonXpTrackStep {
  key!: DailyLessonXpTrackStep['key'];

  rewardXp!: number;

  state!: DailyLessonXpTrackStep['state'];
}

export class DailyLessonXpTrackResponseDto implements DailyLessonXpTrackResponse {
  dayKeyUtc!: string;

  completedLessonsToday!: number;

  nextRewardXp!: number;

  resetsAtUtc!: string;

  steps!: DailyLessonXpTrackStepDto[];
}
