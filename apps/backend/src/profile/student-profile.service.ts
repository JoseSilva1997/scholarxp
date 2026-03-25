// Aggregates student-facing profile data from multiple domain services into the StudentProfileResponse contract.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import type {
  DailyPracticeProfileStatus,
  StudentProfileModule,
  StudentProfileResponse,
} from '@scholarxp/api-contracts';
import { MODULE_UNIT_BASELINE_EXP } from '@scholarxp/constants';
import { getProgressWithinLevel } from '@scholarxp/progression';
import { DailyPracticeService } from '../daily-practice/daily-practice.service';
import { DailyLessonXpTrackService } from '../exp-engine/daily-lesson-xp-track.service';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { QuestStreakService } from '../quests/quest-streak.service';
import type { AuthUser } from '../types/auth-user.type';

@Injectable()
export class StudentProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questStreakService: QuestStreakService,
    private readonly dailyLessonXpTrackService: DailyLessonXpTrackService,
    private readonly dailyPracticeService: DailyPracticeService,
  ) {}

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
      select: { id: true, totalExp: true },
    });
    const totalExp = avatar?.totalExp ?? 0;
    const progress = getProgressWithinLevel(totalExp);
    const accountProgress = {
      id: avatar?.id ?? 0,
      totalExp,
      ...progress,
    };

    const [streakStatus, dailyLessonXPTrack, modules, questSummary] =
      await Promise.all([
        this.questStreakService.getCurrentStreakStatus(user.id, now),
        this.dailyLessonXpTrackService.getTrackForUser(user.id, now),
        this.buildModulesForStudent(user.id),
        this.buildQuestSummary(user.id, now),
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
      // Rewards backend is not yet implemented — return empty arrays.
      rewards: { equipped: [], owned: [], upcoming: [] },
    };
  }

  private async buildModulesForStudent(
    userId: number,
  ): Promise<StudentProfileModule[]> {
    const enrollments = await this.prisma.userModule.findMany({
      where: { userId, roleInModule: 'student' },
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

  // Maps the full daily-practice status response down to the simplified profile enum.
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

  private async buildQuestSummary(userId: number, now: Date) {
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(now);

    // Today's quests: count completed vs total (excluding the master quest which is a meta-quest).
    const todaysQuests = await this.prisma.dailyQuest.findMany({
      where: { userId, questDateUtc: dayStartUtc },
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
