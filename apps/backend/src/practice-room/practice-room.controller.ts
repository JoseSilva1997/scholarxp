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
import { PracticeRoomService } from './practice-room.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { Authorize } from '../auth/decorators/authorize.decorator';
import type { AuthUser } from '../types/auth-user.type';
import { GetPracticeRoomParamsDto } from './dto/get-practice-room-params.dto';
import { ClosePracticeRoomSessionParamsDto } from './dto/close-practice-room-session-params.dto';
import { GetPracticeRoomQueryDto } from './dto/get-practice-room-query.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { features } from '@scholarxp/permissions';

// PracticeRoomController exposes module-unit-scoped room endpoints used when students start practice from a module unit.
@Controller('module/:moduleId/unit/:moduleUnitId/practice-room')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class PracticeRoomController {
  constructor(private readonly practiceRoomService: PracticeRoomService) {}

  // Room access uses module scope so membership/ownership checks run in the shared authorization evaluator.
  @Get()
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  getPracticeRoom(
    @Param() params: GetPracticeRoomParamsDto,
    @Query() query: GetPracticeRoomQueryDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.practiceRoomService.getPracticeRoom(
      params.moduleId,
      params.moduleUnitId,
      user.id,
      query.sessionId,
    );
  }

  // Attempt submissions share the same policy to keep read/answer flows aligned for authorized module users.
  @Post('attempts')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  submitAttempt(
    @Param() params: GetPracticeRoomParamsDto,
    @Body() payload: SubmitAttemptDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.practiceRoomService.submitAttempt(
      params.moduleId,
      params.moduleUnitId,
      user.id,
      payload,
    );
  }

  // Session close is idempotent so client unload/navigation hooks can call it safely without race-sensitive retries.
  @Post('session/:sessionId/close')
  @Authorize({ capability: features.navigation.modules, scope: 'module' })
  closeSession(
    @Param() params: ClosePracticeRoomSessionParamsDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.practiceRoomService.closeSession(
      params.moduleId,
      params.moduleUnitId,
      user.id,
      params.sessionId,
    );
  }
}
