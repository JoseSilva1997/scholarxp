// Owns module-level roster summary reads so activity and coverage rules stay out of the orchestration layer.
import { Injectable, NotFoundException } from '@nestjs/common';
import type { RosterSummaryResponse } from '@scholarxp/api-contracts';
import { ACTIVITY_WINDOW_DAYS, daysAgo } from './roster.helpers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RosterModuleAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Computes the module summary shown at the top of the roster view.
  // Sequential lookups for title and IDs are followed by parallel queries for activity
  // and coverage so the total latency is bounded by the slower of the two aggregations.
  // Returns zeroed coverage when the module has no live lessons or no enrolled students
  // to avoid unnecessary aggregation queries on empty data sets.
  async getSummary(moduleId: number): Promise<RosterSummaryResponse> {
    const sevenDaysAgo = daysAgo(new Date(), ACTIVITY_WINDOW_DAYS);
    const moduleTitle = await this.getModuleTitleOrThrow(moduleId);
    const liveLessonIds = await this.getLiveLessonIds(moduleId);
    const enrolledStudentIds = await this.getEnrolledStudentIds(moduleId);
    const studentCount = enrolledStudentIds.length;

    if (studentCount === 0 || liveLessonIds.length === 0) {
      return {
        moduleId,
        moduleTitle,
        studentsEnrolled: studentCount,
        activeLast7Days: 0,
        atRiskCount: 0,
        lessonCoverage: {
          totalLiveLessons: liveLessonIds.length,
          lessonsStartedByAtLeastOneStudent: 0,
          lessonsCompletedByAtLeastHalfOfStudents: 0,
        },
      };
    }

    const [activeStudentIds, lessonCoverage] = await Promise.all([
      this.getActiveStudentIds(enrolledStudentIds, liveLessonIds, sevenDaysAgo),
      this.getLessonCoverage(liveLessonIds, enrolledStudentIds),
    ]);

    // A student is "at risk" if they have not been active within the rolling window —
    // i.e. they are enrolled but absent from the active set.
    return {
      moduleId,
      moduleTitle,
      studentsEnrolled: studentCount,
      activeLast7Days: activeStudentIds.size,
      atRiskCount: enrolledStudentIds.filter((id) => !activeStudentIds.has(id))
        .length,
      lessonCoverage,
    };
  }

  // Validates module existence early so subsequent queries operate on a known-good ID.
  private async getModuleTitleOrThrow(moduleId: number): Promise<string> {
    const moduleRecord = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { title: true },
    });

    if (!moduleRecord) {
      throw new NotFoundException('Module not found.');
    }

    return moduleRecord.title;
  }

  // Only published ("live") lessons are included in roster analytics; draft or archived
  // lessons should not influence student progress or coverage metrics.
  private async getLiveLessonIds(moduleId: number): Promise<number[]> {
    const lessons = await this.prisma.moduleUnit.findMany({
      where: { moduleId, status: 'live' },
      select: { id: true },
    });

    return lessons.map((lesson) => lesson.id);
  }

  // Filters by roleInModule to exclude tutors and other staff from the enrolled student count.
  private async getEnrolledStudentIds(moduleId: number): Promise<number[]> {
    const enrollments = await this.prisma.userModule.findMany({
      where: { moduleId, roleInModule: 'student' },
      select: { userId: true },
    });

    return enrollments.map((enrollment) => enrollment.userId);
  }

  // A student is considered active if they have submitted at least one question attempt
  // within the activity window, scoped to live lessons of this module. The `distinct`
  // clause ensures each student is counted once regardless of how many attempts they made.
  private async getActiveStudentIds(
    enrolledStudentIds: number[],
    liveLessonIds: number[],
    since: Date,
  ): Promise<Set<number>> {
    if (liveLessonIds.length === 0) return new Set();

    const activeAttempts = await this.prisma.questionAttempt.findMany({
      where: {
        studentId: { in: enrolledStudentIds },
        moduleUnitId: { in: liveLessonIds },
        attemptedAt: { gte: since },
      },
      distinct: ['studentId'],
      select: { studentId: true },
    });

    return new Set(activeAttempts.map((attempt) => attempt.studentId!));
  }

  // Computes lesson coverage statistics used by the tutor dashboard summary card.
  // "Started" means at least one student has a progress record; "completed by half" uses
  // a ceiling division so a 3-student roster requires 2 completions, not 1.5.
  private async getLessonCoverage(
    liveLessonIds: number[],
    enrolledStudentIds: number[],
  ) {
    if (liveLessonIds.length === 0) {
      return {
        totalLiveLessons: 0,
        lessonsStartedByAtLeastOneStudent: 0,
        lessonsCompletedByAtLeastHalfOfStudents: 0,
      };
    }

    // Round up so odd-sized rosters still treat 50% as an inclusive threshold.
    const minimumCompletedStudents = Math.ceil(enrolledStudentIds.length / 2);
    const [startedLessons, completedLessons] = await Promise.all([
      this.prisma.moduleUnitUserProgress.findMany({
        where: {
          moduleUnitId: { in: liveLessonIds },
          studentId: { in: enrolledStudentIds },
        },
        distinct: ['moduleUnitId'],
        select: { moduleUnitId: true },
      }),
      this.prisma.moduleUnitUserProgress.groupBy({
        by: ['moduleUnitId'],
        where: {
          moduleUnitId: { in: liveLessonIds },
          studentId: { in: enrolledStudentIds },
          isCompleted: true,
        },
        _count: { studentId: true },
      }),
    ]);

    return {
      totalLiveLessons: liveLessonIds.length,
      lessonsStartedByAtLeastOneStudent: startedLessons.length,
      lessonsCompletedByAtLeastHalfOfStudents: completedLessons.filter(
        (lesson) => (lesson._count.studentId ?? 0) >= minimumCompletedStudents,
      ).length,
    };
  }
}
