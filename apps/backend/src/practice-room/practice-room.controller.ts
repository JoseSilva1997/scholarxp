import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PracticeRoomService } from './practice-room.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ModuleAccessGuard } from '../auth/guards/module-access.guard';
import { ModuleAccess } from '../auth/decorators/module-access.decorator';
import type { AuthUser } from '../types/auth-user.type';
import { GetPracticeRoomParamsDto } from './dto/get-practice-room-params.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

// PracticeRoomController exposes the room-load endpoint used when students start a practice session.
@Controller('module/:moduleId/unit/:moduleUnitId/practice-room')
export class PracticeRoomController {
  constructor(private readonly practiceRoomService: PracticeRoomService) {}

  // Guarding by module keeps practice-room reads consistent with module-scoped permission rules.
  @Get()
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId', allowStudentRead: true })
  getPracticeRoom(
    @Param() params: GetPracticeRoomParamsDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.practiceRoomService.getPracticeRoom(
      params.moduleId,
      params.moduleUnitId,
      user.id,
    );
  }

  // Attempt submission is module-scoped and reuses the same guard chain as page-load to keep permission checks consistent.
  @Post('attempts')
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId', allowStudentRead: true })
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
}
