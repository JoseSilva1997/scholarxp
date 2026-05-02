// Aggregates student-facing profile data from multiple domain services into a single StudentProfileResponse.
// Consumes the quests, XP engine, and daily-practice modules to avoid duplicating domain logic here.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import type {
  DailyPracticeProfileStatus,
  StudentProfileModule,
  StudentProfileResponse,
} from '@scholarxp/api-contracts';
import { MODULE_UNIT_BASELINE_EXP } from '@scholarxp/constants';
import {
  getProgressWithinLevel,
  sanitizeEquippedCosmetics,
} from '@scholarxp/progression';
import { DailyPracticeService } from '../daily-practice/daily-practice.service';
import { DailyLessonXpTrackService } from '../exp-engine/daily-lesson-xp-track.service';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { QuestStreakService } from '../quests/quest-streak.service';
import type { AuthUser } from '@scholarxp/api-contracts';

@Injectable()
export class StudentProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questStreakService: QuestStreakService,
    private readonly dailyLessonXpTrackService: DailyLessonXpTrackService,
    private readonly dailyPracticeService: DailyPracticeService,
  ) {}

  // Builds the complete student profile payload by fanning out to independent sub-aggregators in
  // parallel (streak, XP track, modules, quest summary) to minimise round-trip latency. Throws
  // ForbiddenException early if the caller is not a student, avoiding unnecessary database work.
  async getStudentProfile(user: AuthUser): Promise<StudentProfileResponse> {
    if (user.globalRole !== GlobalRole.student) {
      throw new ForbiddenException(
        'Only students can access the student profile.',
      );
    }

    const now = new Date();

    // Avatar is always present for students — the promotion flow guarantees it.
    const avatar = await this.prisma.avatar.findUnique({
      where: { userId: user.id },
      select: { id: true, totalExp: true, equippedCosmetics: true },
    });
    const totalExp = avatar?.totalExp ?? 0;
    const progress = getProgressWithinLevel(totalExp);
    // Sanitize against the freshly derived level so the profile view never surfaces an item the
    // user can no longer earn, matching the same invariant enforced on /auth/me.
    const accountProgress = {
      id: avatar?.id ?? 0,
      totalExp,
      ...progress,
      equippedCosmetics: sanitizeEquippedCosmetics(
        avatar?.equippedCosmetics ?? null,
        progress.level,
      ),
    };

    const [streakStatus, dailyLessonXPTrack, modules, questSummary] =
      await Promise.all([
        this.questStreakService.getCurrentStreakStatus(user.id, now),
        this.dailyLessonXpTrackService.getTrackForUser(user.id, now),
        this.buildModulesForStudent(user.id),
        this.buildQuestSummary(user.id, now, user.timezone),
      ]);

    return {
      accountLevel: progress.level,
      totalAccountXP: totalExp,
      xpToNextLevel: progress.xpToNextLevel,
      accountProgress,
      masterQuestStreak: streakStatus.currentStreak,
      todayQuestProgress: questSummary.todayProgress,
      dailyLessonXPTrack,
      modules,
      questHistorySummary: {
        totalCompleted: questSummary.totalCompleted,
        perfectDays: questSummary.perfectDays,
      },
    };
  }

  // Fetches all active module enrolments for the student and resolves per-module lesson-completion
  // counts and daily-practice statuses. Archived modules are excluded so stale content is never
  // surfaced. Completion counts and practice statuses are resolved in parallel per module.
  private async buildModulesForStudent(
    userId: number,
  ): Promise<StudentProfileModule[]> {
    const enrollments = await this.prisma.userModule.findMany({
      where: {
        userId,
        roleInModule: 'student',
        module: { archivedAt: null },
      },
      select: {
        moduleId: true,
        userModuleLevel: true,
        currentExp: true,
        module: {
          select: {
            id: true,
            title: true,
            moduleUnits: {
              where: { status: 'live' },
              select: { id: true },
            },
          },
        },
      },
    });

    // Batch-load completed lesson counts and daily practice statuses in parallel.
    const moduleResults = await Promise.all(
      enrollments.map(async (enrollment) => {
        const moduleId = enrollment.moduleId;
        const liveUnitIds = enrollment.module.moduleUnits.map((u) => u.id);

        const [completedCount, dailyPracticeStatus] = await Promise.all([
          liveUnitIds.length > 0
            ? this.prisma.moduleUnitUserProgress.count({
                where: {
                  studentId: userId,
                  moduleUnitId: { in: liveUnitIds },
                  isCompleted: true,
                },
              })
            : 0,
          this.resolveDailyPracticeStatus(moduleId, userId),
        ]);

        return {
          moduleId,
          title: enrollment.module.title,
          proficiencyLevel: enrollment.userModuleLevel,
          moduleXP: enrollment.currentExp,
          moduleXPMax: MODULE_UNIT_BASELINE_EXP,
          completedLessons: completedCount,
          totalLessons: liveUnitIds.length,
          dailyPracticeStatus,
        };
      }),
    );

    return moduleResults;
  }

  // Translates the rich DailyPracticeService status into the three-state profile enum
  // (done | available | not_available) required by the API contract. Decoupling this mapping
  // means internal practice-engine status changes don't leak into the profile response shape.
  private async resolveDailyPracticeStatus(
    moduleId: number,
    userId: number,
  ): Promise<DailyPracticeProfileStatus> {
    const status = await this.dailyPracticeService.getDailyPracticeStatus(
      moduleId,
      userId,
    );
    if (status.status === 'completed') return 'done';
    if (status.status === 'available' || status.status === 'in_progress')
      return 'available';
    return 'not_available';
  }

  // Derives today's quest progress and all-time summary stats for the student.
  // Today's quests are keyed by the student's local calendar day (not UTC midnight) because quests
  // are generated relative to the student's timezone. Perfect-day counting requires two separate
  // groupBy queries because Prisma does not support conditional aggregation (e.g. COUNT IF) in a
  // single call — the first query finds all quest days, the second finds days with incomplete quests,
  // and perfect days are computed as the set difference.
  private async buildQuestSummary(userId: number, now: Date, timezone: string) {
    const localDateKey = DateHelpers.getLocalDateKey(now, timezone);
    const dayStartDb = new Date(`${localDateKey}T00:00:00.000Z`);

    // Today's quests are keyed by the student's local calendar day, matching quest generation and streak reads.
    const todaysQuests = await this.prisma.dailyQuest.findMany({
      where: { userId, questDateUtc: dayStartDb },
      select: { isCompleted: true, type: true },
    });
    // Master quest is excluded from the count because the UI shows individual quest progress.
    const nonMasterQuests = todaysQuests.filter(
      (q) => q.type !== 'master_daily_quests',
    );
    const todayProgress = {
      completed: nonMasterQuests.filter((q) => q.isCompleted).length,
      total: nonMasterQuests.length,
    };

    // Historical quest summary should mirror the visible daily quest rows, so master quests stay out of this total.
    const totalCompleted = await this.prisma.dailyQuest.count({
      where: {
        userId,
        isCompleted: true,
        type: { not: 'master_daily_quests' },
      },
    });

    // A "perfect day" is a UTC day where every generated non-master quest was completed.
    // Group by questDateUtc and check if all quests for each day are completed.
    const questDays = await this.prisma.dailyQuest.groupBy({
      by: ['questDateUtc'],
      where: { userId, type: { not: 'master_daily_quests' } },
      _count: { id: true },
    });

    // Prisma groupBy doesn't support conditional aggregation, so we count per-day manually.
    // Only query days that have at least one quest.
    const allQuestDayDates = questDays.map((d) => d.questDateUtc);
    let perfectDays = 0;

    if (allQuestDayDates.length > 0) {
      // Batch query: for each quest day, check if any non-master quest is incomplete.
      const incompleteDays = await this.prisma.dailyQuest.groupBy({
        by: ['questDateUtc'],
        where: {
          userId,
          type: { not: 'master_daily_quests' },
          isCompleted: false,
        },
        _count: { id: true },
      });
      const incompleteDaySet = new Set(
        incompleteDays.map((d) => d.questDateUtc.toISOString()),
      );
      perfectDays = allQuestDayDates.filter(
        (d) => !incompleteDaySet.has(d.toISOString()),
      ).length;
    }

    return { todayProgress, totalCompleted, perfectDays };
  }
}
