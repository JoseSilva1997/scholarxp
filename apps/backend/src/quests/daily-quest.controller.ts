// Role: exposes quest read and trigger routes while delegating orchestration to the dedicated quests domain services.
import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { features } from '@scholarxp/permissions';
import type { Request } from 'express';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { GetQuestHistoryQueryDto } from '../db-entities/daily-quest/dto/get-quest-history-query.dto';
import type { AuthUser } from '../types/auth-user.type';
import { MasterQuestStreakResponseDto } from './dto/master-quest-streak-response.dto';
import { QuestHistoryService } from './quest-history.service';
import { QuestProgressService } from './quest-progress.service';
import { QuestStreakService } from './quest-streak.service';
import { QuestProgressResponseDto } from './dto/quest-progress-response.dto';
import { RecordCompletedUnitReviewParamsDto } from './dto/record-completed-unit-review-params.dto';
import { RecordDailyRevisionParamsDto } from './dto/record-daily-revision-params.dto';

type DailyQuestHistoryRequest = Request & {
  user?: AuthUser;
};

@Controller('daily-quest')
export class DailyQuestController {
  constructor(
    private readonly questHistoryService: QuestHistoryService,
    private readonly questProgressService: QuestProgressService,
    private readonly questStreakService: QuestStreakService,
  ) {}

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

  @Get('master-streak')
  @UseGuards(SessionAuthGuard, AuthorizationGuard)
  @Authorize({ capability: features.navigation.quests, scope: 'global' })
  getMyMasterQuestStreak(
    @Req() request: DailyQuestHistoryRequest,
  ): Promise<MasterQuestStreakResponseDto> {
    // Header reads use a dedicated streak service so streak derivation stays out of the controller and UI layers.
    return this.questStreakService.getCurrentStreakStatus(
      (request.user as AuthUser).id,
      new Date(),
    );
  }

  @Post('module/:moduleId/daily-revision-click')
  @UseGuards(SessionAuthGuard, AuthorizationGuard)
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  async recordDailyRevisionClick(
    @Req() request: DailyQuestHistoryRequest,
    @Param() params: RecordDailyRevisionParamsDto,
  ): Promise<QuestProgressResponseDto> {
    // The frontend fires this optimistic trigger before daily revision exists so quest completion still flows through one backend seam.
    await this.questProgressService.recordDailyRevisionButtonClick({
      userId: (request.user as AuthUser).id,
      moduleId: params.moduleId,
      clickedAt: new Date(),
    });

    return { recorded: true };
  }

  @Post('module/:moduleId/unit/:moduleUnitId/completed-review')
  @UseGuards(SessionAuthGuard, AuthorizationGuard)
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  async recordCompletedUnitReview(
    @Req() request: DailyQuestHistoryRequest,
    @Param() params: RecordCompletedUnitReviewParamsDto,
  ): Promise<QuestProgressResponseDto> {
    // Review launches stay non-domain-specific at the controller layer; quest progress service decides whether the lesson qualifies.
    await this.questProgressService.recordCompletedUnitReview({
      userId: (request.user as AuthUser).id,
      moduleId: params.moduleId,
      moduleUnitId: params.moduleUnitId,
      viewedAt: new Date(),
    });

    return { recorded: true };
  }
}
