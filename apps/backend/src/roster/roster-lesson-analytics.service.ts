// Groups lesson-centric roster aggregation so lesson tables and drilldowns share one consistent read model.
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  LessonDrilldownStudentRow,
  RosterLessonsQuery,
  RosterLessonsResponse,
  SortDirection,
} from '@scholarxp/api-contracts';
import { ExpLedgerEventTypes } from '@scholarxp/constants';
import { PrismaService } from '../prisma/prisma.service';
import { LessonDrilldownResponseDto } from './dto/lesson-drilldown.dto';
import {
  MASTERY_EVENT_TYPES,
  buildExpMap,
  buildNestedExpMap,
  computeAverageMastery,
  computeLessonMasteryScore,
  formatFullName,
  percentageFromRatio,
  toIsoOrNull,
  toTimestampOrZero,
} from './roster.helpers';
import {
  AttemptRow,
  computeHighHintUsage,
  computeSlowQuestions,
  computeStrugglingQuestions,
  computeVariantDiscrepancies,
} from './roster-question-health';

@Injectable()
export class RosterLessonAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Retrieves aggregated analytics for all live lessons in a module
  // Computes per-lesson metrics: completion rate, average mastery, and activity timestamps
  // Results can be sorted by title, completion rate, mastery, or recency
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

    // Fetch enrolled students to establish denominator for completion rate calculations
    const lessonIds = liveLessons.map((lesson) => lesson.id);
    const enrolledStudents = await this.prisma.userModule.findMany({
      where: { moduleId, roleInModule: 'student' },
      select: { userId: true },
    });
    const enrolledStudentIds = enrolledStudents.map(
      (enrollment) => enrollment.userId,
    );
    const enrolledCount = enrolledStudentIds.length;

    // Parallelize queries: progress (any interaction), completion (isCompleted), and exp aggregation
    // Ledger aggregation filters to correct answers and mastery events to compute normalized mastery scores
    const [progressAggregates, completedAggregates, ledgerAggregates] =
      await Promise.all([
        this.prisma.moduleUnitUserProgress.groupBy({
          by: ['moduleUnitId'],
          where: { moduleUnitId: { in: lessonIds } },
          _count: { studentId: true },
          _max: { lastPracticedAt: true },
        }),
        this.prisma.moduleUnitUserProgress.groupBy({
          by: ['moduleUnitId'],
          where: { moduleUnitId: { in: lessonIds }, isCompleted: true },
          _count: { studentId: true },
        }),
        this.prisma.expLedger.groupBy({
          by: ['userId', 'moduleUnitId', 'eventType'],
          where: {
            userId: { in: enrolledStudentIds },
            moduleUnitId: { in: lessonIds },
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

    const lessonExpMap = buildNestedExpMap(
      ledgerAggregates,
      (entry) => entry.moduleUnitId,
      (entry) => entry.userId,
    );
    const progressMap = new Map(
      progressAggregates.map((aggregate) => [
        aggregate.moduleUnitId,
        aggregate,
      ]),
    );
    const completedMap = new Map(
      completedAggregates.map((aggregate) => [
        aggregate.moduleUnitId,
        aggregate,
      ]),
    );

    const rows = liveLessons.map((lesson) => {
      const progress = progressMap.get(lesson.id);
      const completed = completedMap.get(lesson.id);
      const lessonExpByStudent = lessonExpMap.get(lesson.id);

      return {
        moduleUnitId: lesson.id,
        title: lesson.title,
        status: lesson.status,
        studentsStarted: progress?._count?.studentId ?? 0,
        studentsCompleted: completed?._count?.studentId ?? 0,
        completionRate: percentageFromRatio(
          completed?._count?.studentId ?? 0,
          enrolledCount,
        ),
        averageMastery: computeAverageMastery(enrolledStudentIds, (studentId) =>
          lessonExpByStudent?.get(studentId),
        ),
        lastPracticedAt: toIsoOrNull(progress?._max?.lastPracticedAt),
      };
    });

    return {
      rows: this.applyLessonSort(rows, query.sortBy, query.sortDirection),
    };
  }

  // Retrieves detailed per-student analytics for a specific lesson (drilldown view)
  // Includes individual mastery scores and aggregated question health indicators
  // Throws NotFoundException if lesson does not exist within the specified module
  async getLessonDrilldown(
    moduleId: number,
    moduleUnitId: number,
  ): Promise<LessonDrilldownResponseDto> {
    const lesson = await this.prisma.moduleUnit.findFirst({
      where: { id: moduleUnitId, moduleId },
      select: { title: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found in this module.');
    }

    const [enrollments, progressRecords, lessonLedger, attempts] =
      await Promise.all([
        this.prisma.userModule.findMany({
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
        }),
        this.prisma.moduleUnitUserProgress.findMany({
          where: { moduleUnitId },
          select: {
            studentId: true,
            isCompleted: true,
            lastPracticedAt: true,
          },
        }),
        this.prisma.expLedger.groupBy({
          by: ['userId', 'eventType'],
          where: {
            moduleUnitId,
            eventType: {
              in: [
                ExpLedgerEventTypes.CORRECT_PRACTICE_ROOM_ANSWER,
                ...MASTERY_EVENT_TYPES,
              ],
            },
          },
          _sum: { awardedExp: true },
        }),
        this.prisma.questionAttempt.findMany({
          where: { moduleUnitId },
          select: {
            id: true,
            sessionId: true,
            studentId: true,
            questionId: true,
            contentId: true,
            isCorrect: true,
            timeTakenMs: true,
            hintsUsed: true,
            attemptedAt: true,
            question: { select: { title: true } },
            content: {
              select: {
                isCore: true,
                questionUnitId: true,
                variantMetadata: { select: { variantLabel: true } },
              },
            },
          },
        }),
      ]);

    const progressByStudent = new Map(
      progressRecords
        .filter((record) => record.studentId !== null)
        .map((record) => [record.studentId!, record]),
    );
    const expByStudent = buildExpMap(lessonLedger, (entry) => entry.userId);

    // Construct student rows by merging enrollment, progress, and exp data
    // Mastery score is rounded to percentage and set null if no exp records exist
    const students: LessonDrilldownStudentRow[] = enrollments.map(
      (enrollment) => {
        const progress = progressByStudent.get(enrollment.userId);
        const exp = expByStudent.get(enrollment.userId);

        return {
          studentId: enrollment.userId,
          fullName: formatFullName(
            enrollment.user.firstName,
            enrollment.user.lastName,
          ),
          avatarUrl: enrollment.user.profilePictureUrl,
          isCompleted: progress?.isCompleted ?? false,
          masteryScore: exp
            ? Math.round(
                computeLessonMasteryScore(exp.completionExp, exp.masteryExp) *
                  100,
              )
            : null,
          lastPracticedAt: toIsoOrNull(progress?.lastPracticedAt),
        };
      },
    );

    return {
      moduleUnitId,
      lessonTitle: lesson.title,
      students,
      questionHealth: this.buildQuestionHealth(attempts as AttemptRow[]),
    };
  }

  // Aggregates question-level health indicators from lesson attempts
  // Delegates to specialized health computation functions in roster-question-health module
  private buildQuestionHealth(attempts: AttemptRow[]) {
    return {
      strugglingQuestions: computeStrugglingQuestions(attempts),
      variantDiscrepancies: computeVariantDiscrepancies(attempts),
      highHintUsage: computeHighHintUsage(attempts),
      slowQuestions: computeSlowQuestions(attempts),
    };
  }

  // Sorts lesson rows in-place by specified dimension; defaults to original order if sortBy is unrecognized
  // Direction: -1 for descending, 1 for ascending
  // Uses numeric comparison for rate/score metrics and locale-aware string comparison for titles
  private applyLessonSort(
    rows: RosterLessonsResponse['rows'],
    sortBy?: string,
    direction?: SortDirection,
  ): RosterLessonsResponse['rows'] {
    const dir = direction === 'desc' ? -1 : 1;
    const sorted = [...rows];

    switch (sortBy) {
      case 'title':
        sorted.sort(
          (left, right) => dir * left.title.localeCompare(right.title),
        );
        break;
      case 'completion_rate':
        sorted.sort(
          (left, right) => dir * (left.completionRate - right.completionRate),
        );
        break;
      case 'average_mastery':
        sorted.sort(
          (left, right) => dir * (left.averageMastery - right.averageMastery),
        );
        break;
      case 'last_practiced':
        sorted.sort(
          (left, right) =>
            dir *
            (toTimestampOrZero(left.lastPracticedAt) -
              toTimestampOrZero(right.lastPracticedAt)),
        );
        break;
      default:
        break;
    }

    return sorted;
  }
}
