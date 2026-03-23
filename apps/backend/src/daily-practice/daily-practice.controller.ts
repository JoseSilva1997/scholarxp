// Controller role: exposes module-scoped daily-practice endpoints while keeping request handling thin and authorization explicit.
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { features } from '@scholarxp/permissions';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthUser } from '../types/auth-user.type';
import { DailyPracticeService } from './daily-practice.service';
import { CloseDailyPracticeSessionParamsDto } from './dto/close-daily-practice-session-params.dto';
import { GetDailyPracticeParamsDto } from './dto/get-daily-practice-params.dto';
import { GetDailyPracticeQueryDto } from './dto/get-daily-practice-query.dto';
import { SubmitDailyPracticeAttemptDto } from './dto/submit-daily-practice-attempt.dto';

@Controller('module/:moduleId/daily-practice')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class DailyPracticeController {
  constructor(private readonly dailyPracticeService: DailyPracticeService) {}

  // Loading "today" either resumes or creates the stable module-scoped set for the authenticated student.
  @Get('today')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  getToday(
    @Param() params: GetDailyPracticeParamsDto,
    @Query() query: GetDailyPracticeQueryDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;

    return this.dailyPracticeService.getTodayDailyPractice(
      params.moduleId,
      user.id,
      query.sessionId,
    );
  }

  // Submit reuses the shared modules capability because daily-practice is still module-scoped student work.
  @Post('attempts')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  submitAttempt(
    @Param() params: GetDailyPracticeParamsDto,
    @Body() payload: SubmitDailyPracticeAttemptDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;

    return this.dailyPracticeService.submitAttempt(
      params.moduleId,
      user.id,
      payload,
    );
  }

  // Idempotent close lets navigation and unload hooks end the session safely without set-specific state on the client.
  @Post('session/:sessionId/close')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  closeSession(
    @Param() params: CloseDailyPracticeSessionParamsDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;

    return this.dailyPracticeService.closeSession(
      params.moduleId,
      user.id,
      params.sessionId,
    );
  }
}
