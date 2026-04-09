// Coordinates focused roster analytics services so controllers depend on one stable backend entrypoint.
import { Injectable } from '@nestjs/common';
import type {
  RosterLessonsQuery,
  RosterLessonsResponse,
  RosterStudentDetailResponse,
  RosterStudentsQuery,
  RosterStudentsResponse,
  RosterSummaryResponse,
} from '@scholarxp/api-contracts';
import { LessonDrilldownResponseDto } from './dto/lesson-drilldown.dto';
import { RosterLessonAnalyticsService } from './roster-lesson-analytics.service';
import { RosterModuleAnalyticsService } from './roster-module-analytics.service';
import { RosterStudentAnalyticsService } from './roster-student-analytics.service';

@Injectable()
export class RosterService {
  constructor(
    private readonly moduleAnalytics: RosterModuleAnalyticsService,
    private readonly studentAnalytics: RosterStudentAnalyticsService,
    private readonly lessonAnalytics: RosterLessonAnalyticsService,
  ) {}

  async getSummary(moduleId: number): Promise<RosterSummaryResponse> {
    return this.moduleAnalytics.getSummary(moduleId);
  }

  async getStudents(
    moduleId: number,
    query: RosterStudentsQuery,
  ): Promise<RosterStudentsResponse> {
    return this.studentAnalytics.getStudents(moduleId, query);
  }

  async getLessons(
    moduleId: number,
    query: RosterLessonsQuery,
  ): Promise<RosterLessonsResponse> {
    return this.lessonAnalytics.getLessons(moduleId, query);
  }

  async getStudentDetail(
    moduleId: number,
    studentId: number,
  ): Promise<RosterStudentDetailResponse> {
    return this.studentAnalytics.getStudentDetail(moduleId, studentId);
  }

  async getLessonDrilldown(
    moduleId: number,
    moduleUnitId: number,
  ): Promise<LessonDrilldownResponseDto> {
    return this.lessonAnalytics.getLessonDrilldown(moduleId, moduleUnitId);
  }
}
