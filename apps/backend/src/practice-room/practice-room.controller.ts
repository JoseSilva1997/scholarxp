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
import { ModuleAccessGuard } from '../auth/guards/module-access.guard';
import { ModuleAccess } from '../auth/decorators/module-access.decorator';
import type { AuthUser } from '../types/auth-user.type';
import { GetPracticeRoomParamsDto } from './dto/get-practice-room-params.dto';
import { GetPracticeRoomQueryDto } from './dto/get-practice-room-query.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';

// PracticeRoomController exposes module-unit-scoped room endpoints used when students start practice from a module unit.
@Controller('module/:moduleId/unit/:moduleUnitId/practice-room')
@UseGuards(SessionAuthGuard, RolesGuard)
export class PracticeRoomController {
  constructor(private readonly practiceRoomService: PracticeRoomService) {}

  // Guarding by module keeps module-unit practice-room reads consistent with module-scoped permission rules.
  @Get()
  @UseGuards(SessionAuthGuard, ModuleAccessGuard)
  @ModuleAccess({ paramKey: 'moduleId', allowStudentRead: true })
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

  // Module-unit attempt submission reuses the same guard chain as room load to keep permission checks consistent.
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
