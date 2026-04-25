// Builds the daily-lesson XP progress view shown in the app header. Centralizes the reward rules so controllers and frontend don't re-implement them.
import { Injectable } from '@nestjs/common';
import { DateHelpers } from '../helpers/helpers';
import { ExpLedgerService } from '../db-entities/exp-ledger/exp-ledger.service';
import { ExpCalculationService } from './exp-calculation.service';
import {
  DailyLessonXpTrackResponseDto,
  DailyLessonXpTrackStepDto,
} from './dto/daily-lesson-xp-track-response.dto';

@Injectable()
export class DailyLessonXpTrackService {
  constructor(
    private readonly expLedgerService: ExpLedgerService,
    private readonly expCalculationService: ExpCalculationService,
  ) {}

  async getTrackForUser(
    userId: number,
    timestamp: Date,
  ): Promise<DailyLessonXpTrackResponseDto> {
    const completedLessonsToday =
      await this.expLedgerService.getTodaysNumberOfCompletedUnits(
        userId,
        undefined,
        timestamp,
      );
    const { dayStartUtc, nextDayStartUtc } =
      DateHelpers.getUtcDayBounds(timestamp);

    return {
      dayKeyUtc: dayStartUtc.toISOString().slice(0, 10),
      completedLessonsToday,
      // Call the same service that actually awards XP, so the preview shown to the user always matches what they'll receive.
      nextRewardXp: this.expCalculationService.resolveDailyCompletionReward(
        completedLessonsToday,
      ),
      resetsAtUtc: nextDayStartUtc.toISOString(),
      steps: this.buildTrackSteps(completedLessonsToday),
    };
  }

  // Three UI steps the header displays: the two rewarded lessons of the day, then an open-ended "practice" slot.
  // Each step's `state` tells the frontend how to render it: already done ('earned'), current target ('active'), or not yet reached ('upcoming').
  private buildTrackSteps(
    completedLessonsToday: number,
  ): DailyLessonXpTrackStepDto[] {
    const steps: DailyLessonXpTrackStepDto[] = [
      {
        key: 'first_completion',
        rewardXp: this.expCalculationService.resolveDailyCompletionReward(0),
        // Earned once any lesson is done today; otherwise it's the user's current target.
        state: completedLessonsToday >= 1 ? 'earned' : 'active',
      },
      {
        key: 'second_completion',
        rewardXp: this.expCalculationService.resolveDailyCompletionReward(1),
        // Only becomes 'active' after the first lesson is done — before that it's locked as 'upcoming'.
        state:
          completedLessonsToday >= 2
            ? 'earned'
            : completedLessonsToday === 1
              ? 'active'
              : 'upcoming',
      },
      {
        key: 'practice',
        rewardXp: this.expCalculationService.resolveDailyCompletionReward(2),
        // Practice slot never reaches 'earned' — it stays active once the two main rewards are collected, signaling further lessons still grant XP at the reduced rate.
        state: completedLessonsToday >= 2 ? 'active' : 'upcoming',
      },
    ];

    return steps;
  }
}
