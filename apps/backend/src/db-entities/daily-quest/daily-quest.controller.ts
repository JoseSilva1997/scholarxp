import { Controller, Get, Req, Query, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../types/auth-user.type';
import { SessionAuthGuard } from '../../auth/guards/session-auth.guard';
import { DailyQuestService } from './daily-quest.service';
import { GetQuestHistoryQueryDto } from './dto/get-quest-history-query.dto';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { Authorize } from '../../auth/decorators/authorize.decorator';
import { features } from '@scholarxp/permissions';

type DailyQuestHistoryRequest = Request & {
  user?: AuthUser;
};

@Controller('daily-quest')
export class DailyQuestController {
  constructor(private readonly dailyQuestService: DailyQuestService) {}

  @Get('history')
  @UseGuards(SessionAuthGuard, AuthorizationGuard)
  @Authorize({ capability: features.navigation.quests, scope: 'global' })
  getMyQuestHistory(
    @Req() request: DailyQuestHistoryRequest,
    @Query() query: GetQuestHistoryQueryDto,
  ) {
    // Guard guarantees authenticated session; cast keeps controller logic concise and type-safe.
    return this.dailyQuestService.listHistoryForUser(
      (request.user as AuthUser).id,
      query,
    );
  }
}
