// Groups student-centric roster aggregation so roster list and detail views share one source of truth.
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  DailyPracticeStatus,
  RosterStudentDetailResponse,
  RosterStudentRow,
  RosterStudentsQuery,
  RosterStudentsResponse,
  SortDirection,
} from '@scholarxp/api-contracts';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
import { DailyPracticeService } from '../daily-practice/daily-practice.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACTIVITY_WINDOW_DAYS,
  MASTERY_EVENT_TYPES,
  buildExpMap,
  buildNestedExpMap,
  computeAverageMastery,
  computeLessonMasteryScore,
  daysAgo,
  formatFullName,
  percentageFromRatio,
  toIsoOrNull,
  toTimestampOrZero,
} from './roster.helpers';

@Injectable()
export class RosterStudentAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyPracticeService: DailyPracticeService,
  ) {}

  async getStudents(
    moduleId: number,
    query: RosterStudentsQuery,
  ): Promise<RosterStudentsResponse> {
    const sevenDaysAgo = daysAgo(new Date(), ACTIVITY_WINDOW_DAYS);
    const liveLessonIds = await this.getLiveLessonIds(moduleId);
    const totalLiveLessons = liveLessonIds.length;
    const enrollments = await this.getStudentEnrollments(moduleId);

    if (enrollments.length === 0) {
      return { rows: [] };
    }

    const studentIds = enrollments.map((enrollment) => enrollment.userId);
    const [
      progressByStudent,
      lastActivityByStudent,
      dailyPracticeStatuses,
      lastDailyPracticeCompletionByStudent,
    ] = await Promise.all([
      this.batchLessonProgress(studentIds, liveLessonIds),
      this.batchLastActivity(studentIds, liveLessonIds),
      this.batchDailyPracticeStatus(moduleId, studentIds),
      this.batchLastDailyPracticeCompletion(moduleId, studentIds),
    ]);

    let rows: RosterStudentRow[] = enrollments.map((enrollment) => {
      const studentId = enrollment.userId;
      const progress = progressByStudent.get(studentId) ?? {
        completed: 0,
        averageMastery: 0,
      };
      const lastActivityAt = lastActivityByStudent.get(studentId) ?? null;
      const dailyPracticeStatus =
        dailyPracticeStatuses.get(studentId) ?? 'locked';
      const lastDailyPracticeCompletedAt =
        lastDailyPracticeCompletionByStudent.get(studentId) ?? null;
      const isAtRisk =
        lastActivityAt === null ||
        lastActivityAt.getTime() < sevenDaysAgo.getTime();

      return {
        studentId,
        fullName: formatFullName(
          enrollment.user.firstName,
          enrollment.user.lastName,
        ),
        avatarUrl: enrollment.user.profilePictureUrl,
        moduleLevel: enrollment.userModuleLevel,
        currentXp: enrollment.currentExp,
        completedLessons: progress.completed,
        totalLiveLessons,
        averageMastery: progress.averageMastery,
        dailyPracticeStatus,
        lastDailyPracticeCompletedAt: toIsoOrNull(lastDailyPracticeCompletedAt),
        lastActivityAt: toIsoOrNull(lastActivityAt),
        enrolledAt: enrollment.createdAt.toISOString(),
        enrolledVia: enrollment.enrolledVia,
        isAtRisk,
      };
    });

    rows = this.applyStudentFilter(rows, query.filter);
    rows = this.applyStudentSearch(rows, query.search);
    rows = this.applyStudentSort(rows, query.sortBy, query.sortDirection);

    return { rows };
  }

  async getStudentDetail(
    moduleId: number,
    studentId: number,
  ): Promise<RosterStudentDetailResponse> {
    const sevenDaysAgo = daysAgo(new Date(), ACTIVITY_WINDOW_DAYS);
    const enrollment = await this.prisma.userModule.findUnique({
      where: { moduleId_userId: { moduleId, userId: studentId } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    if (!enrollment || enrollment.roleInModule !== 'student') {
      throw new NotFoundException('Student not found in this module.');
    }

    const liveLessons = await this.prisma.moduleUnit.findMany({
      where: { moduleId, status: 'live' },
      select: { id: true, title: true },
      orderBy: { sortOrder: 'asc' },
    });
    const liveLessonIds = liveLessons.map((lesson) => lesson.id);

    const [
      progressRecords,
      recentAttempts,
      dailyPracticeStatus,
      lastActivity,
      ledgerAggregates,
    ] = await Promise.all([
      this.prisma.moduleUnitUserProgress.findMany({
        where: { studentId, moduleUnitId: { in: liveLessonIds } },
      }),
      this.prisma.questionAttempt.findMany({
        where: {
          studentId,
          moduleUnitId: { in: liveLessonIds },
          attemptedAt: { gte: sevenDaysAgo },
        },
        select: {
          isCorrect: true,
          timeTakenMs: true,
          hintsUsed: true,
        },
      }),
      this.dailyPracticeService.getDailyPracticeStatus(moduleId, studentId),
      this.prisma.questionAttempt.findFirst({
        where: { studentId, moduleUnitId: { in: liveLessonIds } },
        orderBy: { attemptedAt: 'desc' },
        select: { attemptedAt: true },
      }),
      this.prisma.expLedger.groupBy({
        by: ['moduleUnitId', 'eventType'],
        where: {
          userId: studentId,
          moduleUnitId: { in: liveLessonIds },
          eventType: {
            in: [
              ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
              ...MASTERY_EVENT_TYPES,
            ],
          },
        },
        _sum: { awardedExp: true },
      }),
    ]);

    const lessonExpMap = buildExpMap(
      ledgerAggregates,
      (entry) => entry.moduleUnitId,
    );
    const progressMap = new Map(
      progressRecords.map((record) => [record.moduleUnitId, record]),
    );
    const lessonProgress = liveLessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      const exp = lessonExpMap.get(lesson.id);

      return {
        moduleUnitId: lesson.id,
        lessonTitle: lesson.title,
        isCompleted: progress?.isCompleted ?? false,
        currentMasteryScore: Math.round(
          computeLessonMasteryScore(
            exp?.completionExp ?? 0,
            exp?.masteryExp ?? 0,
          ) * 100,
        ),
        completedAt: toIsoOrNull(progress?.completedAt),
        lastPracticedAt: toIsoOrNull(progress?.lastPracticedAt),
      };
    });

    return {
      student: {
        studentId,
        fullName: formatFullName(
          enrollment.user.firstName,
          enrollment.user.lastName,
        ),
        avatarUrl: enrollment.user.profilePictureUrl,
        enrolledAt: enrollment.createdAt.toISOString(),
        enrolledVia: enrollment.enrolledVia,
        moduleLevel: enrollment.userModuleLevel,
        currentXp: enrollment.currentExp,
        completedLessons: progressRecords.filter((record) => record.isCompleted)
          .length,
        totalLiveLessons: liveLessonIds.length,
        averageMastery: computeAverageMastery(liveLessonIds, (lessonId) =>
          lessonExpMap.get(lessonId),
        ),
        dailyPracticeStatus: dailyPracticeStatus.status,
        lastActivityAt: toIsoOrNull(lastActivity?.attemptedAt),
      },
      lessonProgress,
      recentPerformance: this.computeRecentPerformance(recentAttempts),
    };
  }

  private async getLiveLessonIds(moduleId: number): Promise<number[]> {
    const lessons = await this.prisma.moduleUnit.findMany({
      where: { moduleId, status: 'live' },
      select: { id: true },
    });

    return lessons.map((lesson) => lesson.id);
  }

  private async getStudentEnrollments(moduleId: number) {
    return this.prisma.userModule.findMany({
      where: { moduleId, roleInModule: 'student' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
      },
    });
  }

  private async batchLessonProgress(
    studentIds: number[],
    liveLessonIds: number[],
  ): Promise<Map<number, { completed: number; averageMastery: number }>> {
    const result = new Map<
      number,
      { completed: number; averageMastery: number }
    >();
    if (liveLessonIds.length === 0) return result;

    const [progressRecords, ledgerAggregates] = await Promise.all([
      this.prisma.moduleUnitUserProgress.findMany({
        where: {
          studentId: { in: studentIds },
          moduleUnitId: { in: liveLessonIds },
        },
        select: { studentId: true, moduleUnitId: true, isCompleted: true },
      }),
      this.prisma.expLedger.groupBy({
        by: ['userId', 'moduleUnitId', 'eventType'],
        where: {
          userId: { in: studentIds },
          moduleUnitId: { in: liveLessonIds },
          eventType: {
            in: [
              ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
              ...MASTERY_EVENT_TYPES,
            ],
          },
        },
        _sum: { awardedExp: true },
      }),
    ]);

    const ledgerByStudent = buildNestedExpMap(
      ledgerAggregates,
      (entry) => entry.userId,
      (entry) => entry.moduleUnitId,
    );
    const completedByStudent = new Map<number, number>();

    for (const record of progressRecords) {
      if (record.studentId === null || !record.isCompleted) continue;
      completedByStudent.set(
        record.studentId,
        (completedByStudent.get(record.studentId) ?? 0) + 1,
      );
    }

    for (const studentId of studentIds) {
      const lessonExpMap = ledgerByStudent.get(studentId);
      result.set(studentId, {
        completed: completedByStudent.get(studentId) ?? 0,
        averageMastery: computeAverageMastery(liveLessonIds, (lessonId) =>
          lessonExpMap?.get(lessonId),
        ),
      });
    }

    return result;
  }

  private async batchLastActivity(
    studentIds: number[],
    liveLessonIds: number[],
  ): Promise<Map<number, Date>> {
    const result = new Map<number, Date>();
    if (liveLessonIds.length === 0) return result;

    const attempts = await this.prisma.questionAttempt.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        moduleUnitId: { in: liveLessonIds },
      },
      _max: { attemptedAt: true },
    });

    for (const attempt of attempts) {
      if (attempt.studentId !== null && attempt._max.attemptedAt) {
        result.set(attempt.studentId, attempt._max.attemptedAt);
      }
    }

    return result;
  }

  private async batchDailyPracticeStatus(
    moduleId: number,
    studentIds: number[],
  ): Promise<Map<number, DailyPracticeStatus>> {
    const statuses = await Promise.all(
      studentIds.map(async (studentId) => {
        const { status } =
          await this.dailyPracticeService.getDailyPracticeStatus(
            moduleId,
            studentId,
          );

        return [studentId, status] as const;
      }),
    );

    return new Map(statuses);
  }

  private async batchLastDailyPracticeCompletion(
    moduleId: number,
    studentIds: number[],
  ): Promise<Map<number, Date>> {
    const result = new Map<number, Date>();
    const completions = await this.prisma.dailyPracticeSet.findMany({
      where: {
        moduleId,
        userId: { in: studentIds },
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      distinct: ['userId'],
      select: { userId: true, completedAt: true },
    });

    for (const completion of completions) {
      if (completion.completedAt) {
        result.set(completion.userId, completion.completedAt);
      }
    }

    return result;
  }

  private computeRecentPerformance(
    attempts: { isCorrect: boolean; timeTakenMs: number; hintsUsed: number }[],
  ) {
    const totalAttempts = attempts.length;
    if (totalAttempts === 0) {
      return {
        accuracyLast7Days: null,
        averageTimeMsLast7Days: null,
        hintsUsedLast7Days: null,
      };
    }

    const correctCount = attempts.filter((attempt) => attempt.isCorrect).length;
    const totalTimeMs = attempts.reduce(
      (sum, attempt) => sum + attempt.timeTakenMs,
      0,
    );
    const totalHintsUsed = attempts.reduce(
      (sum, attempt) => sum + attempt.hintsUsed,
      0,
    );

    return {
      accuracyLast7Days: percentageFromRatio(correctCount, totalAttempts),
      averageTimeMsLast7Days: Math.round(totalTimeMs / totalAttempts),
      hintsUsedLast7Days: totalHintsUsed,
    };
  }

  private applyStudentFilter(
    rows: RosterStudentRow[],
    filter?: string,
  ): RosterStudentRow[] {
    if (!filter || filter === 'all') return rows;

    switch (filter) {
      case 'active_7d':
        return rows.filter(
          (row) => row.lastActivityAt !== null && !row.isAtRisk,
        );
      case 'inactive_7d':
      case 'at_risk':
        return rows.filter((row) => row.isAtRisk);
      case 'daily_practice_locked':
        return rows.filter((row) => row.dailyPracticeStatus === 'locked');
      case 'daily_practice_unlocked':
        return rows.filter((row) => row.dailyPracticeStatus !== 'locked');
      default:
        return rows;
    }
  }

  private applyStudentSearch(
    rows: RosterStudentRow[],
    search?: string,
  ): RosterStudentRow[] {
    if (!search || search.trim().length === 0) return rows;

    const term = search.toLowerCase().trim();
    return rows.filter((row) => row.fullName.toLowerCase().includes(term));
  }

  private applyStudentSort(
    rows: RosterStudentRow[],
    sortBy?: string,
    direction?: SortDirection,
  ): RosterStudentRow[] {
    const dir = direction === 'desc' ? -1 : 1;
    const sorted = [...rows];

    switch (sortBy) {
      case 'name':
        sorted.sort(
          (left, right) => dir * left.fullName.localeCompare(right.fullName),
        );
        break;
      case 'last_activity':
        sorted.sort(
          (left, right) =>
            dir *
            (toTimestampOrZero(left.lastActivityAt) -
              toTimestampOrZero(right.lastActivityAt)),
        );
        break;
      case 'completed_lessons':
        sorted.sort(
          (left, right) =>
            dir * (left.completedLessons - right.completedLessons),
        );
        break;
      default:
        sorted.sort((left, right) =>
          left.fullName.localeCompare(right.fullName),
        );
        break;
    }

    return sorted;
  }
}
