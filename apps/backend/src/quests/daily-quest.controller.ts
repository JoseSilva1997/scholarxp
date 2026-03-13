// Role: exposes quest read routes while delegating orchestration to the dedicated quests domain services.
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { features } from '@scholarxp/permissions';
import type { Request } from 'express';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { GetQuestHistoryQueryDto } from '../db-entities/daily-quest/dto/get-quest-history-query.dto';
import type { AuthUser } from '../types/auth-user.type';
import { QuestHistoryService } from './quest-history.service';

type DailyQuestHistoryRequest = Request & {
  user?: AuthUser;
};

@Controller('daily-quest')
export class DailyQuestController {
  constructor(private readonly questHistoryService: QuestHistoryService) {}

  @Get('history')
  @UseGuards(SessionAuthGuard, AuthorizationGuard)
  @Authorize({ capability: features.navigation.quests, scope: 'global' })
  getMyQuestHistory(
    @Req() request: DailyQuestHistoryRequest,
    @Query() query: GetQuestHistoryQueryDto,
  ) {
    // Guard guarantees authenticated session; the dedicated quest service owns generation/read orchestration.
    return this.questHistoryService.listHistoryForUser(
      (request.user as AuthUser).id,
      query,
    );
  }
}
