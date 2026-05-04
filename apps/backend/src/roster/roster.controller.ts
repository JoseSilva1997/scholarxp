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
import type { AuthUser } from '@scholarxp/api-contracts';
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

// All routes are scoped under module/:moduleId/roster and require both an active session
// and a module-level capability check enforced by AuthorizationGuard.
@Controller('module/:moduleId/roster')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  // Returns aggregate statistics for the module: enrolment count, recent activity, and lesson coverage.
  @Get('summary')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getSummary(@Param() params: RosterModuleParamsDto) {
    return this.rosterService.getSummary(params.moduleId);
  }

  // Returns the student list for the module, supporting server-side filter, search, and sort via query params.
  @Get('students')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getStudents(
    @Param() params: RosterModuleParamsDto,
    @Query() query: RosterStudentsQueryDto,
  ) {
    return this.rosterService.getStudents(params.moduleId, query);
  }

  // Returns lesson-level analytics for the module, supporting server-side sort via query params.
  @Get('lessons')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getLessons(
    @Param() params: RosterModuleParamsDto,
    @Query() query: RosterLessonsQueryDto,
  ) {
    return this.rosterService.getLessons(params.moduleId, query);
  }

  // Returns a detailed analytics profile for a single student within the module.
  @Get('students/:studentId')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getStudentDetail(@Param() params: RosterStudentParamsDto) {
    return this.rosterService.getStudentDetail(
      params.moduleId,
      params.studentId,
    );
  }

  // Removes a student from the module. The requester's ID is extracted from the session
  // and forwarded so the service can prevent self-removal.
  @Delete('students/:studentId')
  @Authorize({ capability: features.modules.removeStudent, scope: 'module' })
  removeStudent(@Param() params: RosterStudentParamsDto, @Req() req: Request) {
    const requester = req.user as AuthUser;
    return this.rosterService.removeStudent(
      params.moduleId,
      params.studentId,
      requester.id,
    );
  }

  // Returns a per-student breakdown and question health diagnostics for a specific lesson.
  @Get('lessons/:moduleUnitId')
  @Authorize({ capability: features.modules.roster, scope: 'module' })
  getLessonDrilldown(@Param() params: RosterLessonParamsDto) {
    return this.rosterService.getLessonDrilldown(
      params.moduleId,
      params.moduleUnitId,
    );
  }
}
