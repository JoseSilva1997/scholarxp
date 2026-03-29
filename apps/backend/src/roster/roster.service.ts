// Aggregates module-scoped roster analytics for tutors: enrollment, lesson coverage, review health, and per-student metrics.
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  DailyPracticeStatus,
  RosterLessonsQuery,
  RosterLessonsResponse,
  RosterReviewQuery,
  RosterReviewResponse,
  RosterReviewRow,
  RosterStudentDetailResponse,
  RosterStudentRow,
  RosterStudentsQuery,
  RosterStudentsResponse,
  RosterSummaryResponse,
  SortDirection,
} from '@scholarxp/api-contracts';
import {
  ExpLedgerEventTypes,
  MASTERY_TOTAL_EXP,
  MODULE_UNIT_BASELINE_EXP,
  ROSTER_MASTERY_COMPLETION_WEIGHT,
  ROSTER_MASTERY_EXP_WEIGHT,
} from '@scholarxp/constants';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPracticeService } from '../daily-practice/daily-practice.service';
import { DateHelpers } from '../helpers/helpers';

// At-risk definition: no activity in last 7 days OR any overdue review items.
// Transparent and simple so tutors can act on it without guessing at the heuristic.
const ACTIVITY_WINDOW_DAYS = 7;

@Injectable()
export class RosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyPracticeService: DailyPracticeService,
  ) {}

  async getSummary(moduleId: number): Promise<RosterSummaryResponse> {
    const now = new Date();
    const sevenDaysAgo = this.daysAgo(now, ACTIVITY_WINDOW_DAYS);

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
        reviewBacklog: {
          studentsWithOverdueReviews: 0,
          totalOverdueReviews: 0,
        },
      };
    }

    const [activeStudentIds, lessonCoverage, reviewBacklog] = await Promise.all(
      [
        this.getActiveStudentIds(
          enrolledStudentIds,
          liveLessonIds,
          sevenDaysAgo,
        ),
        this.getLessonCoverage(liveLessonIds, enrolledStudentIds),
        this.getReviewBacklog(moduleId, enrolledStudentIds, now),
      ],
    );

    // At-risk = inactive (no attempts in 7 days) OR has overdue reviews
    const overdueStudentIds = await this.getStudentIdsWithOverdueReviews(
      moduleId,
      enrolledStudentIds,
      now,
    );
    const inactiveStudentIds = enrolledStudentIds.filter(
      (id) => !activeStudentIds.has(id),
    );
    const atRiskSet = new Set([...inactiveStudentIds, ...overdueStudentIds]);

    return {
      moduleId,
      moduleTitle,
      studentsEnrolled: studentCount,
      activeLast7Days: activeStudentIds.size,
      atRiskCount: atRiskSet.size,
      lessonCoverage,
      reviewBacklog,
    };
  }

  async getStudents(
    moduleId: number,
    query: RosterStudentsQuery,
  ): Promise<RosterStudentsResponse> {
    const now = new Date();
    const sevenDaysAgo = this.daysAgo(now, ACTIVITY_WINDOW_DAYS);
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(now);

    const liveLessons = await this.getLiveLessonIds(moduleId);
    const totalLiveLessons = liveLessons.length;

    // Fetch enrolled students with user data and module-level info in one query
    const enrollments = await this.prisma.userModule.findMany({
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

    if (enrollments.length === 0) {
      return { rows: [] };
    }

    const studentIds = enrollments.map((e) => e.userId);

    // Batch queries for all students at once to avoid N+1
    const [
      progressByStudent,
      reviewsByStudent,
      lastActivityByStudent,
      dailyPracticeStatuses,
    ] = await Promise.all([
      this.batchLessonProgress(studentIds, liveLessons),
      this.batchReviewCounts(moduleId, studentIds, now, dayStartUtc),
      this.batchLastActivity(studentIds, liveLessons),
      this.batchDailyPracticeStatus(moduleId, studentIds),
    ]);

    let rows: RosterStudentRow[] = enrollments.map((enrollment) => {
      const studentId = enrollment.userId;
      const progress = progressByStudent.get(studentId) ?? {
        completed: 0,
        averageMastery: 0,
      };
      const reviews = reviewsByStudent.get(studentId) ?? {
        due: 0,
        overdue: 0,
      };
      const lastActivityAt = lastActivityByStudent.get(studentId) ?? null;
      const dailyPracticeStatus =
        dailyPracticeStatuses.get(studentId) ?? 'locked';

      const averageMastery = progress.averageMastery;

      const isActive =
        lastActivityAt !== null &&
        new Date(lastActivityAt).getTime() >= sevenDaysAgo.getTime();
      const isAtRisk = !isActive || reviews.overdue > 0;

      return {
        studentId,
        fullName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
        avatarUrl: enrollment.user.profilePictureUrl,
        moduleLevel: enrollment.userModuleLevel,
        currentXp: enrollment.currentExp,
        completedLessons: progress.completed,
        totalLiveLessons,
        averageMastery,
        dailyPracticeStatus,
        dueReviewCount: reviews.due,
        overdueReviewCount: reviews.overdue,
        lastActivityAt: lastActivityAt
          ? new Date(lastActivityAt).toISOString()
          : null,
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

  async getLessons(
    moduleId: number,
    query: RosterLessonsQuery,
  ): Promise<RosterLessonsResponse> {
    const liveLessons = await this.prisma.moduleUnit.findMany({
      where: { moduleId, status: 'live' },
      select: { id: true, title: true, status: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (liveLessons.length === 0) {
      return { rows: [] };
    }

    const enrolledCount = await this.prisma.userModule.count({
      where: { moduleId, roleInModule: 'student' },
    });

    const lessonIds = liveLessons.map((l) => l.id);

    // Aggregate progress per lesson in one query
    const progressAggregates = await this.prisma.moduleUnitUserProgress.groupBy(
      {
        by: ['moduleUnitId'],
        where: { moduleUnitId: { in: lessonIds } },
        _count: { studentId: true },
        _avg: { currentMasteryScore: true },
        _max: { lastPracticedAt: true },
      },
    );

    const completedAggregates =
      await this.prisma.moduleUnitUserProgress.groupBy({
        by: ['moduleUnitId'],
        where: { moduleUnitId: { in: lessonIds }, isCompleted: true },
        _count: { studentId: true },
      });

    const progressMap = new Map(
      progressAggregates.map((p) => [p.moduleUnitId, p]),
    );
    const completedMap = new Map(
      completedAggregates.map((c) => [c.moduleUnitId, c]),
    );

    let rows = liveLessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      const completed = completedMap.get(lesson.id);

      const studentsStarted = progress?._count?.studentId ?? 0;
      const studentsCompleted = completed?._count?.studentId ?? 0;
      const completionRate =
        enrolledCount > 0
          ? Math.round((studentsCompleted / enrolledCount) * 100)
          : 0;
      // Prisma _avg returns the raw 0–1 decimal; contract expects 0–100 integer.
      const averageMastery = Math.round(
        (progress?._avg?.currentMasteryScore ?? 0) * 100,
      );
      const lastPracticedAt = progress?._max?.lastPracticedAt ?? null;

      return {
        moduleUnitId: lesson.id,
        title: lesson.title,
        status: lesson.status,
        studentsStarted,
        studentsCompleted,
        completionRate,
        averageMastery,
        lastPracticedAt: lastPracticedAt ? lastPracticedAt.toISOString() : null,
      };
    });

    rows = this.applyLessonSort(rows, query.sortBy, query.sortDirection);

    return { rows };
  }

  async getReview(
    moduleId: number,
    query: RosterReviewQuery,
  ): Promise<RosterReviewResponse> {
    const now = new Date();
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(now);

    const enrollments = await this.prisma.userModule.findMany({
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

    if (enrollments.length === 0) {
      return { rows: [] };
    }

    const studentIds = enrollments.map((e) => e.userId);

    const [reviewsByStudent, dailyPracticeStatuses, lastDpCompletionByStudent] =
      await Promise.all([
        this.batchReviewCountsWithLapses(
          moduleId,
          studentIds,
          now,
          dayStartUtc,
        ),
        this.batchDailyPracticeStatus(moduleId, studentIds),
        this.batchLastDailyPracticeCompletion(moduleId, studentIds),
      ]);

    let rows: RosterReviewRow[] = enrollments.map((enrollment) => {
      const studentId = enrollment.userId;
      const reviews = reviewsByStudent.get(studentId) ?? {
        due: 0,
        overdue: 0,
        lapses: 0,
      };
      const dailyPracticeStatus =
        dailyPracticeStatuses.get(studentId) ?? 'locked';
      const lastDpCompletion = lastDpCompletionByStudent.get(studentId) ?? null;

      return {
        studentId,
        fullName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
        avatarUrl: enrollment.user.profilePictureUrl,
        dueReviewCount: reviews.due,
        overdueReviewCount: reviews.overdue,
        lapseCount: reviews.lapses,
        dailyPracticeStatus,
        lastDailyPracticeCompletedAt: lastDpCompletion
          ? lastDpCompletion.toISOString()
          : null,
      };
    });

    rows = this.applyReviewSort(rows, query.sortBy, query.sortDirection);

    return { rows };
  }

  async getStudentDetail(
    moduleId: number,
    studentId: number,
  ): Promise<RosterStudentDetailResponse> {
    const now = new Date();
    const sevenDaysAgo = this.daysAgo(now, ACTIVITY_WINDOW_DAYS);
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(now);

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

    const liveLessonIds = liveLessons.map((l) => l.id);

    const masteryEventTypes = [
      ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED,
      ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_GRADUATED,
      ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED,
    ] as const;

    const [
      progressRecords,
      reviewStates,
      recentAttempts,
      dailyPracticeStatus,
      lastActivity,
      ledgerAggregates,
    ] = await Promise.all([
      this.prisma.moduleUnitUserProgress.findMany({
        where: { studentId, moduleUnitId: { in: liveLessonIds } },
      }),
      this.prisma.studentQuestionState.findMany({
        where: { userId: studentId, moduleId },
        select: {
          fsrsDueAt: true,
          lapseCount: true,
        },
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
              ...masteryEventTypes,
            ],
          },
        },
        _sum: { awardedExp: true },
      }),
    ]);

    const lastDpCompletion = await this.prisma.dailyPracticeSet.findFirst({
      where: { userId: studentId, moduleId, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    // Build: moduleUnitId → { completionExp, masteryExp } from the ledger aggregates
    type LessonExp = { completionExp: number; masteryExp: number };
    const lessonExpMap = new Map<number, LessonExp>();
    for (const entry of ledgerAggregates) {
      if (entry.moduleUnitId === null) continue;
      const existing = lessonExpMap.get(entry.moduleUnitId) ?? {
        completionExp: 0,
        masteryExp: 0,
      };
      const exp = entry._sum.awardedExp ?? 0;
      if (
        entry.eventType === ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER
      ) {
        existing.completionExp += exp;
      } else {
        existing.masteryExp += exp;
      }
      lessonExpMap.set(entry.moduleUnitId, existing);
    }

    // Build per-lesson progress
    const progressMap = new Map(
      progressRecords.map((p) => [p.moduleUnitId, p]),
    );

    const lessonProgress = liveLessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      const exp = lessonExpMap.get(lesson.id) ?? {
        completionExp: 0,
        masteryExp: 0,
      };
      return {
        moduleUnitId: lesson.id,
        lessonTitle: lesson.title,
        isCompleted: progress?.isCompleted ?? false,
        currentMasteryScore: Math.round(
          this.computeLessonMasteryScore(exp.completionExp, exp.masteryExp) *
            100,
        ),
        completedAt: progress?.completedAt?.toISOString() ?? null,
        lastPracticedAt: progress?.lastPracticedAt?.toISOString() ?? null,
      };
    });

    // Compute review state
    let dueReviewCount = 0;
    let overdueReviewCount = 0;
    let totalLapses = 0;
    for (const state of reviewStates) {
      if (state.fsrsDueAt <= now) dueReviewCount++;
      if (state.fsrsDueAt < dayStartUtc) overdueReviewCount++;
      totalLapses += state.lapseCount;
    }

    // Compute recent performance
    const totalAttempts = recentAttempts.length;
    let accuracyLast7Days: number | null = null;
    let averageTimeMsLast7Days: number | null = null;
    let hintsUsedLast7Days: number | null = null;

    if (totalAttempts > 0) {
      const correctCount = recentAttempts.filter((a) => a.isCorrect).length;
      accuracyLast7Days = Math.round((correctCount / totalAttempts) * 100);
      averageTimeMsLast7Days = Math.round(
        recentAttempts.reduce((sum, a) => sum + a.timeTakenMs, 0) /
          totalAttempts,
      );
      hintsUsedLast7Days = recentAttempts.reduce(
        (sum, a) => sum + a.hintsUsed,
        0,
      );
    }

    // Compute overview aggregates
    const completedLessons = progressRecords.filter(
      (p) => liveLessonIds.includes(p.moduleUnitId) && p.isCompleted,
    ).length;
    // Average mastery over ALL live lessons so unstarted lessons reduce the score
    const averageMastery =
      liveLessonIds.length > 0
        ? Math.round(
            (liveLessonIds.reduce((sum, id) => {
              const exp = lessonExpMap.get(id) ?? {
                completionExp: 0,
                masteryExp: 0,
              };
              return (
                sum +
                this.computeLessonMasteryScore(
                  exp.completionExp,
                  exp.masteryExp,
                )
              );
            }, 0) /
              liveLessonIds.length) *
              100,
          )
        : 0;

    return {
      student: {
        studentId,
        fullName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
        avatarUrl: enrollment.user.profilePictureUrl,
        enrolledAt: enrollment.createdAt.toISOString(),
        enrolledVia: enrollment.enrolledVia,
        moduleLevel: enrollment.userModuleLevel,
        currentXp: enrollment.currentExp,
        completedLessons,
        totalLiveLessons: liveLessonIds.length,
        averageMastery,
        dailyPracticeStatus: dailyPracticeStatus.status,
        lastActivityAt: lastActivity?.attemptedAt?.toISOString() ?? null,
      },
      lessonProgress,
      reviewState: {
        dueReviewCount,
        overdueReviewCount,
        lapseCount: totalLapses,
        lastDailyPracticeCompletedAt:
          lastDpCompletion?.completedAt?.toISOString() ?? null,
      },
      recentPerformance: {
        accuracyLast7Days,
        averageTimeMsLast7Days,
        hintsUsedLast7Days,
      },
    };
  }

  // --- Private helpers ---

  private async getModuleTitleOrThrow(moduleId: number): Promise<string> {
    const mod = await this.prisma.module.findUnique({
      where: { id: moduleId },
      select: { title: true },
    });
    if (!mod) {
      throw new NotFoundException('Module not found.');
    }
    return mod.title;
  }

  private async getLiveLessonIds(moduleId: number): Promise<number[]> {
    const lessons = await this.prisma.moduleUnit.findMany({
      where: { moduleId, status: 'live' },
      select: { id: true },
    });
    return lessons.map((l) => l.id);
  }

  private async getEnrolledStudentIds(moduleId: number): Promise<number[]> {
    const enrollments = await this.prisma.userModule.findMany({
      where: { moduleId, roleInModule: 'student' },
      select: { userId: true },
    });
    return enrollments.map((e) => e.userId);
  }

  // Returns set of student IDs who have attempted any question in the module's live units within the window.
  private async getActiveStudentIds(
    enrolledStudentIds: number[],
    liveLessonIds: number[],
    since: Date,
  ): Promise<Set<number>> {
    if (liveLessonIds.length === 0) return new Set();

    const active = await this.prisma.questionAttempt.findMany({
      where: {
        studentId: { in: enrolledStudentIds },
        moduleUnitId: { in: liveLessonIds },
        attemptedAt: { gte: since },
      },
      distinct: ['studentId'],
      select: { studentId: true },
    });
    return new Set(active.map((a) => a.studentId!));
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

  private async getReviewBacklog(
    moduleId: number,
    enrolledStudentIds: number[],
    now: Date,
  ) {
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(now);

    const overdueStates = await this.prisma.studentQuestionState.findMany({
      where: {
        moduleId,
        userId: { in: enrolledStudentIds },
        fsrsDueAt: { lt: dayStartUtc },
      },
      select: { userId: true },
    });

    const studentsWithOverdue = new Set(overdueStates.map((s) => s.userId));

    return {
      studentsWithOverdueReviews: studentsWithOverdue.size,
      totalOverdueReviews: overdueStates.length,
    };
  }

  private async getStudentIdsWithOverdueReviews(
    moduleId: number,
    enrolledStudentIds: number[],
    now: Date,
  ): Promise<number[]> {
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(now);

    const results = await this.prisma.studentQuestionState.findMany({
      where: {
        moduleId,
        userId: { in: enrolledStudentIds },
        fsrsDueAt: { lt: dayStartUtc },
      },
      distinct: ['userId'],
      select: { userId: true },
    });

    return results.map((r) => r.userId);
  }

  // Batch-fetches lesson progress per student: completed count and mastery score averaged over
  // ALL live lessons (unstarted lessons count as 0 — excluding them would overstate mastery).
  private async batchLessonProgress(
    studentIds: number[],
    liveLessonIds: number[],
  ): Promise<Map<number, { completed: number; averageMastery: number }>> {
    const result = new Map<
      number,
      { completed: number; averageMastery: number }
    >();
    if (liveLessonIds.length === 0) return result;

    const masteryEventTypes = [
      ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_ENCOUNTERED,
      ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_GRADUATED,
      ExpLedgerEventTypes.DAILY_PRACTICE_MASTERY_RETAINED,
    ] as const;

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
              ...masteryEventTypes,
            ],
          },
        },
        _sum: { awardedExp: true },
      }),
    ]);

    // Build: studentId → moduleUnitId → { completionExp, masteryExp }
    type LessonExp = { completionExp: number; masteryExp: number };
    const ledgerMap = new Map<number, Map<number, LessonExp>>();
    for (const entry of ledgerAggregates) {
      if (entry.moduleUnitId === null) continue;
      const byLesson =
        ledgerMap.get(entry.userId) ?? new Map<number, LessonExp>();
      const lessonExp = byLesson.get(entry.moduleUnitId) ?? {
        completionExp: 0,
        masteryExp: 0,
      };
      const exp = entry._sum.awardedExp ?? 0;
      if (
        entry.eventType === ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER
      ) {
        lessonExp.completionExp += exp;
      } else {
        lessonExp.masteryExp += exp;
      }
      byLesson.set(entry.moduleUnitId, lessonExp);
      ledgerMap.set(entry.userId, byLesson);
    }

    // Build: studentId → completed lesson count
    const completedByStudent = new Map<number, number>();
    for (const record of progressRecords) {
      if (record.studentId === null) continue;
      if (record.isCompleted) {
        completedByStudent.set(
          record.studentId,
          (completedByStudent.get(record.studentId) ?? 0) + 1,
        );
      }
    }

    // Average mastery over ALL live lessons so unstarted lessons reduce the score
    for (const studentId of studentIds) {
      const byLesson = ledgerMap.get(studentId);
      let masterySum = 0;
      for (const lessonId of liveLessonIds) {
        const exp = byLesson?.get(lessonId) ?? {
          completionExp: 0,
          masteryExp: 0,
        };
        masterySum += this.computeLessonMasteryScore(
          exp.completionExp,
          exp.masteryExp,
        );
      }
      result.set(studentId, {
        completed: completedByStudent.get(studentId) ?? 0,
        averageMastery: Math.round((masterySum / liveLessonIds.length) * 100),
      });
    }

    return result;
  }

  // Blends completion rate and mastery XP rate into a 0–1 lesson mastery score.
  // Caps each component at its known maximum so over-earning doesn't push past 100%.
  private computeLessonMasteryScore(
    completionExp: number,
    masteryExp: number,
  ): number {
    const completionRate =
      Math.min(completionExp, MODULE_UNIT_BASELINE_EXP) /
      MODULE_UNIT_BASELINE_EXP;
    const masteryRate =
      Math.min(masteryExp, MASTERY_TOTAL_EXP) / MASTERY_TOTAL_EXP;
    return (
      completionRate * ROSTER_MASTERY_COMPLETION_WEIGHT +
      masteryRate * ROSTER_MASTERY_EXP_WEIGHT
    );
  }

  // Batch-fetches due and overdue review counts per student.
  private async batchReviewCounts(
    moduleId: number,
    studentIds: number[],
    now: Date,
    dayStartUtc: Date,
  ): Promise<Map<number, { due: number; overdue: number }>> {
    const result = new Map<number, { due: number; overdue: number }>();

    const states = await this.prisma.studentQuestionState.findMany({
      where: {
        moduleId,
        userId: { in: studentIds },
        fsrsDueAt: { lte: now },
      },
      select: { userId: true, fsrsDueAt: true },
    });

    for (const state of states) {
      const existing = result.get(state.userId) ?? { due: 0, overdue: 0 };
      existing.due++;
      if (state.fsrsDueAt < dayStartUtc) existing.overdue++;
      result.set(state.userId, existing);
    }

    return result;
  }

  // Extended version that also counts lapses, used by the review tab.
  private async batchReviewCountsWithLapses(
    moduleId: number,
    studentIds: number[],
    now: Date,
    dayStartUtc: Date,
  ): Promise<Map<number, { due: number; overdue: number; lapses: number }>> {
    const result = new Map<
      number,
      { due: number; overdue: number; lapses: number }
    >();

    // Two queries: one for due items (includes lapse counts), one for total lapses
    const [dueStates, lapseAggregates] = await Promise.all([
      this.prisma.studentQuestionState.findMany({
        where: {
          moduleId,
          userId: { in: studentIds },
          fsrsDueAt: { lte: now },
        },
        select: { userId: true, fsrsDueAt: true },
      }),
      this.prisma.studentQuestionState.groupBy({
        by: ['userId'],
        where: {
          moduleId,
          userId: { in: studentIds },
        },
        _sum: { lapseCount: true },
      }),
    ]);

    const lapseMap = new Map(
      lapseAggregates.map((a) => [a.userId, a._sum.lapseCount ?? 0]),
    );

    // Initialize all students with zero counts so the lapse-only students appear
    for (const id of studentIds) {
      result.set(id, { due: 0, overdue: 0, lapses: lapseMap.get(id) ?? 0 });
    }

    for (const state of dueStates) {
      const existing = result.get(state.userId)!;
      existing.due++;
      if (state.fsrsDueAt < dayStartUtc) existing.overdue++;
    }

    return result;
  }

  // Returns last activity timestamp per student, defined as most recent question attempt in the module's live units.
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

    for (const a of attempts) {
      if (a.studentId !== null && a._max.attemptedAt) {
        result.set(a.studentId, a._max.attemptedAt);
      }
    }

    return result;
  }

  // Batch-fetches daily practice status for each student via the existing service.
  // Uses the service directly per-student since the eligibility check involves
  // multiple conditions (lesson completion timing, set existence, set completion) that
  // are already encapsulated there. Acceptable for roster sizes (typically < 200 students).
  private async batchDailyPracticeStatus(
    moduleId: number,
    studentIds: number[],
  ): Promise<Map<number, DailyPracticeStatus>> {
    const result = new Map<number, DailyPracticeStatus>();

    const statuses = await Promise.all(
      studentIds.map(async (studentId) => {
        const status = await this.dailyPracticeService.getDailyPracticeStatus(
          moduleId,
          studentId,
        );
        return { studentId, status: status.status };
      }),
    );

    for (const { studentId, status } of statuses) {
      result.set(studentId, status);
    }

    return result;
  }

  private async batchLastDailyPracticeCompletion(
    moduleId: number,
    studentIds: number[],
  ): Promise<Map<number, Date>> {
    const result = new Map<number, Date>();

    // Find the most recent completed daily practice set per student
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

    for (const c of completions) {
      if (c.completedAt) {
        result.set(c.userId, c.completedAt);
      }
    }

    return result;
  }

  private daysAgo(now: Date, days: number): Date {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  // --- Filtering & sorting helpers ---

  private applyStudentFilter(
    rows: RosterStudentRow[],
    filter?: string,
  ): RosterStudentRow[] {
    if (!filter || filter === 'all') return rows;

    switch (filter) {
      case 'active_7d':
        return rows.filter((r) => r.lastActivityAt !== null && !r.isAtRisk);
      case 'inactive_7d':
        return rows.filter(
          (r) =>
            r.lastActivityAt === null ||
            new Date(r.lastActivityAt).getTime() <
              this.daysAgo(new Date(), ACTIVITY_WINDOW_DAYS).getTime(),
        );
      case 'at_risk':
        return rows.filter((r) => r.isAtRisk);
      case 'daily_practice_locked':
        return rows.filter((r) => r.dailyPracticeStatus === 'locked');
      case 'daily_practice_unlocked':
        return rows.filter((r) => r.dailyPracticeStatus !== 'locked');
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
    return rows.filter((r) => r.fullName.toLowerCase().includes(term));
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
        sorted.sort((a, b) => dir * a.fullName.localeCompare(b.fullName));
        break;
      case 'last_activity':
        sorted.sort((a, b) => {
          const aTime = a.lastActivityAt
            ? new Date(a.lastActivityAt).getTime()
            : 0;
          const bTime = b.lastActivityAt
            ? new Date(b.lastActivityAt).getTime()
            : 0;
          return dir * (aTime - bTime);
        });
        break;
      case 'completed_lessons':
        sorted.sort((a, b) => dir * (a.completedLessons - b.completedLessons));
        break;
      case 'due_review_count':
        sorted.sort((a, b) => dir * (a.dueReviewCount - b.dueReviewCount));
        break;
      default:
        // Default: sort by name ascending for stable output
        sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
    }

    return sorted;
  }

  private applyLessonSort(
    rows: RosterLessonsResponse['rows'],
    sortBy?: string,
    direction?: SortDirection,
  ): RosterLessonsResponse['rows'] {
    const dir = direction === 'desc' ? -1 : 1;
    const sorted = [...rows];

    switch (sortBy) {
      case 'title':
        sorted.sort((a, b) => dir * a.title.localeCompare(b.title));
        break;
      case 'completion_rate':
        sorted.sort((a, b) => dir * (a.completionRate - b.completionRate));
        break;
      case 'average_mastery':
        sorted.sort((a, b) => dir * (a.averageMastery - b.averageMastery));
        break;
      case 'last_practiced':
        sorted.sort((a, b) => {
          const aTime = a.lastPracticedAt
            ? new Date(a.lastPracticedAt).getTime()
            : 0;
          const bTime = b.lastPracticedAt
            ? new Date(b.lastPracticedAt).getTime()
            : 0;
          return dir * (aTime - bTime);
        });
        break;
      default:
        break;
    }

    return sorted;
  }

  private applyReviewSort(
    rows: RosterReviewRow[],
    sortBy?: string,
    direction?: SortDirection,
  ): RosterReviewRow[] {
    const dir = direction === 'desc' ? -1 : 1;
    const sorted = [...rows];

    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => dir * a.fullName.localeCompare(b.fullName));
        break;
      case 'due_review_count':
        sorted.sort((a, b) => dir * (a.dueReviewCount - b.dueReviewCount));
        break;
      case 'overdue_review_count':
        sorted.sort(
          (a, b) => dir * (a.overdueReviewCount - b.overdueReviewCount),
        );
        break;
      case 'lapse_count':
        sorted.sort((a, b) => dir * (a.lapseCount - b.lapseCount));
        break;
      default:
        sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
    }

    return sorted;
  }
}
