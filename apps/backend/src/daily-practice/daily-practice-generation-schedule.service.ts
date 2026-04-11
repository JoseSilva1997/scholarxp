// Role: triggers daily-practice batch generation on boot and around local midnight so reads can stay load-only.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

  // Startup backfills the current local day after downtime because scheduled runs only target local-midnight windows.
  async runStartupGeneration() {
    await this.runGeneration('startup');
  }

  // Quarter-hour polling catches full-, half-, and quarter-offset timezones shortly after their local midnight.
  @Cron('*/15 * * * *', {
    name: DAILY_PRACTICE_GENERATION_CRON_NAME,
    timeZone: 'UTC',
  })
  async handleScheduledGenerationWindow() {
    await this.runGeneration('scheduled', true);
  }

  private async runGeneration(
    trigger: 'startup' | 'scheduled',
    onlyLocalMidnightWindow: boolean = false,
  ) {
    try {
      const result =
        await this.dailyPracticeGenerationBatchService.generateDailyPracticeSetsForAllStudents(
          new Date(),
          undefined,
          { onlyLocalMidnightWindow },
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
