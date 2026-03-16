// Service role: derives the standalone header reward-track view so controllers and the UI do not duplicate pacing rules.
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
      // Reuse the awarding calculator so the next visible reward can never drift from the actual rule.
      nextRewardXp: this.expCalculationService.resolveDailyCompletionReward(
        completedLessonsToday,
      ),
      resetsAtUtc: nextDayStartUtc.toISOString(),
      steps: this.buildTrackSteps(completedLessonsToday),
    };
  }

  private buildTrackSteps(
    completedLessonsToday: number,
  ): DailyLessonXpTrackStepDto[] {
    const steps: DailyLessonXpTrackStepDto[] = [
      {
        key: 'first_completion',
        rewardXp: this.expCalculationService.resolveDailyCompletionReward(0),
        state: completedLessonsToday >= 1 ? 'earned' : 'active',
      },
      {
        key: 'second_completion',
        rewardXp: this.expCalculationService.resolveDailyCompletionReward(1),
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
        state: completedLessonsToday >= 2 ? 'active' : 'upcoming',
      },
    ];

    return steps;
  }
}
