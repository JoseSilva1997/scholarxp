// Role: triggers daily-practice batch generation on boot and at UTC midnight so reads can stay load-only.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DailyPracticeGenerationBatchService } from './daily-practice-generation-batch.service';

export const DAILY_PRACTICE_GENERATION_CRON_NAME = 'daily-practice-generation';

@Injectable()
export class DailyPracticeGenerationScheduleService implements OnModuleInit {
  private readonly logger = new Logger(
    DailyPracticeGenerationScheduleService.name,
  );

  constructor(
    private readonly dailyPracticeGenerationBatchService: DailyPracticeGenerationBatchService,
  ) {}

  onModuleInit() {
    void this.runStartupGeneration();
  }

  // Startup backfills the current UTC day after downtime so the first student request does not become a hidden generator.
  async runStartupGeneration() {
    await this.runGeneration('startup');
  }

  // UTC midnight keeps set creation aligned with the product rule that a new day begins globally, not per server locale.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: DAILY_PRACTICE_GENERATION_CRON_NAME,
    timeZone: 'UTC',
  })
  async handleUtcMidnightGeneration() {
    await this.runGeneration('scheduled');
  }

  private async runGeneration(trigger: 'startup' | 'scheduled') {
    try {
      const result =
        await this.dailyPracticeGenerationBatchService.generateDailyPracticeSetsForAllStudents(
          new Date(),
        );
      this.logger.log(
        `Completed ${trigger} daily-practice generation for ${result.processedMembershipCount} enrollment(s), created ${result.createdSetCount} set(s), with ${result.failedMembershipCount} failure(s).`,
      );
    } catch (error) {
      this.logger.error(
        `Failed ${trigger} daily-practice generation.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
