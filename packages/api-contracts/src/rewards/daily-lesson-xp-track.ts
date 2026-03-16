/* Reward-track contracts expose the daily lesson XP pacing rule in a frontend-friendly shape while keeping the rule backend-owned. */

export type DailyLessonXpTrackStepKey =
  | 'first_completion'
  | 'second_completion'
  | 'practice';

export type DailyLessonXpTrackStepState = 'earned' | 'active' | 'upcoming';

export interface DailyLessonXpTrackStep {
  key: DailyLessonXpTrackStepKey;
  rewardXp: number;
  state: DailyLessonXpTrackStepState;
}

export interface DailyLessonXpTrackResponse {
  dayKeyUtc: string;
  completedLessonsToday: number;
  nextRewardXp: number;
  resetsAtUtc: string;
  steps: DailyLessonXpTrackStep[];
}
