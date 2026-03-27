// Role: decides whether daily-practice quests are safe to generate without creating or mutating the day's set.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { DailyPracticeEligibilityService } from '../daily-practice/daily-practice-eligibility.service';
import { DailyPracticeSetReadService } from '../daily-practice/daily-practice-set-read.service';
import { DailyPracticeSetSelectorService } from '../daily-practice/daily-practice-set-selector.service';

@Injectable()
export class QuestDailyPracticeAvailabilityService {
  constructor(
    private readonly dailyPracticeSetReadService: DailyPracticeSetReadService,
    private readonly dailyPracticeEligibilityService: DailyPracticeEligibilityService,
    private readonly dailyPracticeSetSelectorService: DailyPracticeSetSelectorService,
  ) {}

  // Returns all modules with available daily practice — used when multiple complete_daily_practice quests can be generated.
  async findAllAvailableModuleIds(
    userId: number,
    moduleIds: number[],
    timestamp: Date,
  ): Promise<number[]> {
    const result: number[] = [];
    const seenModuleIds = new Set<number>();

    for (const moduleId of moduleIds) {
      if (seenModuleIds.has(moduleId)) {
        continue;
      }
      seenModuleIds.add(moduleId);

      if (
        await this.isDailyPracticeAvailableForModule(userId, moduleId, timestamp)
      ) {
        result.push(moduleId);
      }
    }

    return result;
  }

  // Quest generation only needs the first viable module, so this helper keeps the ordering and short-circuit rule centralized.
  async findFirstAvailableModuleId(
    userId: number,
    moduleIds: number[],
    timestamp: Date,
  ): Promise<number | null> {
    const seenModuleIds = new Set<number>();

    for (const moduleId of moduleIds) {
      if (seenModuleIds.has(moduleId)) {
        continue;
      }
      seenModuleIds.add(moduleId);

      if (
        await this.isDailyPracticeAvailableForModule(
          userId,
          moduleId,
          timestamp,
        )
      ) {
        return moduleId;
      }
    }

    return null;
  }

  private async isDailyPracticeAvailableForModule(
    userId: number,
    moduleId: number,
    timestamp: Date,
  ): Promise<boolean> {
    const existingSet = await this.dailyPracticeSetReadService.findSetForUtcDay(
      userId,
      moduleId,
      timestamp,
    );
    if (existingSet) {
      return existingSet.items.length > 0;
    }

    try {
      await this.dailyPracticeEligibilityService.assertEligibleForToday(
        moduleId,
        userId,
        timestamp,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return false;
      }
      throw error;
    }

    const selection =
      await this.dailyPracticeSetSelectorService.selectQuestions({
        userId,
        moduleId,
        now: timestamp,
      });

    return selection.selectedQuestions.length > 0;
  }
}
