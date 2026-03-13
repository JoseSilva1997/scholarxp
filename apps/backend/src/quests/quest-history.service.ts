// Role: coordinates quest-read flows so controllers can stay thin and quest generation can run before history reads.
import { Injectable } from '@nestjs/common';
import { DailyQuestService } from '../db-entities/daily-quest/daily-quest.service';
import { GetQuestHistoryQueryDto } from '../db-entities/daily-quest/dto/get-quest-history-query.dto';
import { QuestHistoryResponseDto } from '../db-entities/daily-quest/dto/quest-history-response.dto';
import { QuestGenerationService } from './quest-generation.service';

@Injectable()
export class QuestHistoryService {
  constructor(
    private readonly questGenerationService: QuestGenerationService,
    private readonly dailyQuestService: DailyQuestService,
  ) {}

  // Read flows should always pass through quest orchestration so "generate if missing" logic has one backend entrypoint.
  async listHistoryForUser(
    userId: number,
    query: GetQuestHistoryQueryDto,
  ): Promise<QuestHistoryResponseDto> {
    await this.questGenerationService.ensureQuestDayGeneratedForUser(userId);
    return this.dailyQuestService.listHistoryForUser(userId, query);
  }
}
