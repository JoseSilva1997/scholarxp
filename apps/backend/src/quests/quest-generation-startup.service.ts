/* Service role: seeds today's quest day once when the backend boots so the
current UTC day exists before student traffic resumes after downtime.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QuestGenerationBatchService } from './quest-generation-batch.service';

@Injectable()
export class QuestGenerationStartupService implements OnModuleInit {
  private readonly logger = new Logger(QuestGenerationStartupService.name);

  constructor(
    private readonly questGenerationBatchService: QuestGenerationBatchService,
  ) {}

  onModuleInit() {
    void this.runStartupGeneration();
  }

  private async runStartupGeneration() {
    try {
      // Running on module init seeds today's quests before normal reads while lazy generation remains the fallback for any misses.
      const result =
        await this.questGenerationBatchService.generateQuestDayForAllStudents(
          new Date(),
        );
      this.logger.log(
        `Generated startup daily quests for ${result.processedUserCount} student(s) with ${result.failedUserCount} failure(s).`,
      );
    } catch (error) {
      // Startup should stay available even if the bootstrap pass fails because per-user generation still backfills on demand.
      this.logger.error(
        'Failed to generate startup daily quests.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
