// Controller role: exposes standalone reward-read endpoints while delegating pacing derivation to focused services.
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { features } from '@scholarxp/permissions';
import type { Request } from 'express';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthUser } from '../types/auth-user.type';
import { DailyLessonXpTrackResponseDto } from './dto/daily-lesson-xp-track-response.dto';
import { DailyLessonXpTrackService } from './daily-lesson-xp-track.service';

type RewardsRequest = Request & {
  user?: AuthUser;
};

@Controller('rewards')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class RewardsController {
  constructor(
    private readonly dailyLessonXpTrackService: DailyLessonXpTrackService,
  ) {}

  @Get('daily-lesson-xp-track')
  @Authorize({ capability: features.navigation.profile, scope: 'global' })
  getMyDailyLessonXpTrack(
    @Req() request: RewardsRequest,
  ): Promise<DailyLessonXpTrackResponseDto> {
    // Reward pacing is global student state, so the controller only forwards the authenticated user and current timestamp.
    return this.dailyLessonXpTrackService.getTrackForUser(
      (request.user as AuthUser).id,
      new Date(),
    );
  }
}
