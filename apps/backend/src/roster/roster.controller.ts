// Exposes module-scoped roster endpoints for tutors; keeps request handling thin and delegates all aggregation to RosterService.
import {
  Controller,
  Delete,
  Get,
  Param,
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
import {
  RosterLessonParamsDto,
  RosterModuleParamsDto,
  RosterStudentParamsDto,
} from './dto/roster-params.dto';
import {
  RosterStudentsQueryDto,
  RosterLessonsQueryDto,
} from './dto/roster-query.dto';
import { RosterService } from './roster.service';

@Controller('module/:moduleId/roster')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Get('summary')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getSummary(@Param() params: RosterModuleParamsDto) {
    return this.rosterService.getSummary(params.moduleId);
  }

  @Get('students')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getStudents(
    @Param() params: RosterModuleParamsDto,
    @Query() query: RosterStudentsQueryDto,
  ) {
    return this.rosterService.getStudents(params.moduleId, query);
  }

  @Get('lessons')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getLessons(
    @Param() params: RosterModuleParamsDto,
    @Query() query: RosterLessonsQueryDto,
  ) {
    return this.rosterService.getLessons(params.moduleId, query);
  }

  @Get('students/:studentId')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getStudentDetail(@Param() params: RosterStudentParamsDto) {
    return this.rosterService.getStudentDetail(
      params.moduleId,
      params.studentId,
    );
  }

  @Delete('students/:studentId')
  @Authorize({ capability: features.modules.removeStudent, scope: 'module' })
  removeStudent(
    @Param() params: RosterStudentParamsDto,
    @Req() req: Request,
  ) {
    const requester = req.user as AuthUser;
    return this.rosterService.removeStudent(
      params.moduleId,
      params.studentId,
      requester.id,
    );
  }

  @Get('lessons/:moduleUnitId')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getLessonDrilldown(@Param() params: RosterLessonParamsDto) {
    return this.rosterService.getLessonDrilldown(
      params.moduleId,
      params.moduleUnitId,
    );
  }
}
