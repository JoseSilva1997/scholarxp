// Owns module-level roster summary reads so activity and coverage rules stay out of the orchestration layer.
import { Injectable, NotFoundException } from '@nestjs/common';
import type { RosterSummaryResponse } from '@scholarxp/api-contracts';
import { ACTIVITY_WINDOW_DAYS, daysAgo } from './roster.helpers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RosterModuleAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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
          lessonsCompletedByAtLeastOneStudent: 0,
        },
      };
    }

    const [activeStudentIds, lessonCoverage] = await Promise.all([
      this.getActiveStudentIds(enrolledStudentIds, liveLessonIds, sevenDaysAgo),
      this.getLessonCoverage(liveLessonIds, enrolledStudentIds),
    ]);

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

  private async getLiveLessonIds(moduleId: number): Promise<number[]> {
    const lessons = await this.prisma.moduleUnit.findMany({
      where: { moduleId, status: 'live' },
      select: { id: true },
    });

    return lessons.map((lesson) => lesson.id);
  }

  private async getEnrolledStudentIds(moduleId: number): Promise<number[]> {
    const enrollments = await this.prisma.userModule.findMany({
      where: { moduleId, roleInModule: 'student' },
      select: { userId: true },
    });

    return enrollments.map((enrollment) => enrollment.userId);
  }

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

  private async getLessonCoverage(
    liveLessonIds: number[],
    enrolledStudentIds: number[],
  ) {
    if (liveLessonIds.length === 0) {
      return {
        totalLiveLessons: 0,
        lessonsStartedByAtLeastOneStudent: 0,
        lessonsCompletedByAtLeastOneStudent: 0,
      };
    }

    const [startedLessons, completedLessons] = await Promise.all([
      this.prisma.moduleUnitUserProgress.findMany({
        where: {
          moduleUnitId: { in: liveLessonIds },
          studentId: { in: enrolledStudentIds },
        },
        distinct: ['moduleUnitId'],
        select: { moduleUnitId: true },
      }),
      this.prisma.moduleUnitUserProgress.findMany({
        where: {
          moduleUnitId: { in: liveLessonIds },
          studentId: { in: enrolledStudentIds },
          isCompleted: true,
        },
        distinct: ['moduleUnitId'],
        select: { moduleUnitId: true },
      }),
    ]);

    return {
      totalLiveLessons: liveLessonIds.length,
      lessonsStartedByAtLeastOneStudent: startedLessons.length,
      lessonsCompletedByAtLeastOneStudent: completedLessons.length,
    };
  }
}
