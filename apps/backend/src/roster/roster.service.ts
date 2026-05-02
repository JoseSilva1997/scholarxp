// Coordinates focused roster analytics services so controllers depend on one stable backend entrypoint.
// Facade pattern: this service owns no data-access logic itself; it routes each operation
// to the appropriate specialised analytics service.
import { Injectable } from '@nestjs/common';
import type {
  RemoveRosterStudentResponse,
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

  // Returns module-level headline statistics: enrolment, activity, and lesson coverage.
  async getSummary(moduleId: number): Promise<RosterSummaryResponse> {
    return this.moduleAnalytics.getSummary(moduleId);
  }

  // Returns the filtered, searched, and sorted student list for the module.
  async getStudents(
    moduleId: number,
    query: RosterStudentsQuery,
  ): Promise<RosterStudentsResponse> {
    return this.studentAnalytics.getStudents(moduleId, query);
  }

  // Returns lesson-level analytics rows for the module, optionally sorted.
  async getLessons(
    moduleId: number,
    query: RosterLessonsQuery,
  ): Promise<RosterLessonsResponse> {
    return this.lessonAnalytics.getLessons(moduleId, query);
  }

  // Returns a full analytics profile for a single enrolled student.
  async getStudentDetail(
    moduleId: number,
    studentId: number,
  ): Promise<RosterStudentDetailResponse> {
    return this.studentAnalytics.getStudentDetail(moduleId, studentId);
  }

  // Removes a student from the module. Passes requesterUserId so the service can
  // guard against a tutor accidentally removing themselves.
  async removeStudent(
    moduleId: number,
    studentId: number,
    requesterUserId: number,
  ): Promise<RemoveRosterStudentResponse> {
    return this.studentAnalytics.removeStudent(
      moduleId,
      studentId,
      requesterUserId,
    );
  }

  // Returns per-student progress and question health diagnostics for a specific lesson.
  async getLessonDrilldown(
    moduleId: number,
    moduleUnitId: number,
  ): Promise<LessonDrilldownResponseDto> {
    return this.lessonAnalytics.getLessonDrilldown(moduleId, moduleUnitId);
  }
}
