// Role: owns quest-day generation orchestration so quest selection rules stay out of CRUD services and controllers.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  QuestTypeValues,
  getQuestDefinition,
  type QuestType,
} from '@scholarxp/api-contracts';
import {
  MASTER_QUEST_COMPLETION_REWARD,
  MAX_DAILY_QUEST_COUNT,
  QUEST_COMPLETION_REWARD,
} from '@scholarxp/constants';
import { DateHelpers } from '../helpers/helpers';
import { PrismaService } from '../prisma/prisma.service';
import { QuestDailyPracticeAvailabilityService } from './quest-daily-practice-availability.service';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

type GeneratedQuestDraft = {
  userId: number;
  moduleId: number | null;
  moduleUnitId: number | null;
  type: QuestType;
  expGranted: number;
  questDateUtc: Date;
};

type ExistingQuestRecord = {
  id: number;
  moduleId: number | null;
  type: QuestType;
  expGranted: number;
  isCompleted: boolean;
};

type ModuleQuestTarget = {
  moduleId: number;
};

@Injectable()
export class QuestGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questDailyPracticeAvailabilityService: QuestDailyPracticeAvailabilityService,
  ) {}

  // This seam exists so future quest selection rules can be added without changing read controllers or storage services.
  async ensureQuestDayGeneratedForUser(
    userId: number,
    timestamp: Date = new Date(),
    tx?: PrismaClientLike,
  ): Promise<void> {
    const prismaClient = tx ?? this.prisma;

    // Load timezone once here so all downstream calls (eligibility, day bounds, DB date) stay consistent.
    const userRecord = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const timezone = userRecord?.timezone ?? 'UTC';

    // dayStartDb is the local calendar date stored as UTC midnight — used for @db.Date column lookups.
    // dayStartUtc is the actual UTC instant of local midnight — used for DateTime range queries.
    const localDateKey = DateHelpers.getLocalDateKey(timestamp, timezone);
    const dayStartDb = new Date(`${localDateKey}T00:00:00.000Z`);
    const { dayStartUtc } = DateHelpers.getLocalDayBounds(timestamp, timezone);

    const existingQuests = await prismaClient.dailyQuest.findMany({
      where: {
        userId,
        questDateUtc: dayStartDb,
      },
      select: {
        id: true,
        moduleId: true,
        type: true,
        expGranted: true,
        isCompleted: true,
      },
    });
    const existingTypes = new Set(
      existingQuests.map((quest) => quest.type as QuestType),
    );
    const normalizedExistingQuests = existingQuests.map(
      (quest): ExistingQuestRecord => ({
        id: quest.id,
        moduleId: quest.moduleId,
        type: quest.type as QuestType,
        expGranted: quest.expGranted,
        isCompleted: quest.isCompleted,
      }),
    );
    // Keyed by `type:moduleId` so complete_daily_practice deduplication is per-module.
    const existingQuestKeySet = new Set(
      normalizedExistingQuests.map((q) => `${q.type}:${q.moduleId ?? 'null'}`),
    );
    const hasLessonQuest =
      existingTypes.has(QuestTypeValues.completeNewUnit) ||
      existingTypes.has(QuestTypeValues.moduleUnitRetry);

    const enrolledModuleIds = await this.listEnrolledModuleIds(
      userId,
      prismaClient,
    );
    if (enrolledModuleIds.length === 0) {
      return;
    }

    const completedUnitTarget = await this.selectCompletedUnitTarget(
      userId,
      enrolledModuleIds,
      dayStartUtc, // actual UTC of local midnight — the completedAt comparison is a DateTime query
      prismaClient,
    );
    // Product rule: quests unlock only after the student has both joined a module and
    // completed at least one lesson on a previous UTC day, so same-day completions never
    // retroactively create quests before the next rollover.
    if (!completedUnitTarget) {
      return;
    }

    // All modules with available daily practice — each earns its own complete_daily_practice quest.
    const availableDailyPracticeModuleIds =
      await this.selectAllAvailableDailyPracticeModuleIds({
        userId,
        enrolledModuleIds,
        timestamp,
        timezone,
      });

    // module_unit_retry (importance 1) is suppressed when any importance-5 daily practice quests
    // exist, since the student has higher-value actions available.
    const hasDailyPractice = availableDailyPracticeModuleIds.length > 0;
    const lessonQuestTarget = hasLessonQuest
      ? null
      : await this.selectLessonQuestTarget(
          userId,
          enrolledModuleIds,
          prismaClient,
          hasDailyPractice,
        );

    const drafts: GeneratedQuestDraft[] = [];

    // complete_daily_practice (importance 5): one quest per module with an available set.
    for (const moduleId of availableDailyPracticeModuleIds) {
      if (
        !existingQuestKeySet.has(
          `${QuestTypeValues.completeDailyPractice}:${moduleId}`,
        )
      ) {
        drafts.push(
          this.buildQuestDraft({
            userId,
            moduleId,
            moduleUnitId: null,
            type: QuestTypeValues.completeDailyPractice,
            questDateUtc: dayStartDb,
          }),
        );
      }
    }

    // daily_practice_streak (importance 3): one per day for the first available module.
    const streakModuleId = availableDailyPracticeModuleIds[0] ?? null;
    if (
      streakModuleId !== null &&
      !existingQuestKeySet.has(
        `${QuestTypeValues.dailyPracticeStreak}:${streakModuleId}`,
      )
    ) {
      drafts.push(
        this.buildQuestDraft({
          userId,
          moduleId: streakModuleId,
          moduleUnitId: null,
          type: QuestTypeValues.dailyPracticeStreak,
          questDateUtc: dayStartDb,
        }),
      );
    }

    if (lessonQuestTarget) {
      drafts.push(
        this.buildQuestDraft({
          userId,
          moduleId: lessonQuestTarget.moduleId,
          moduleUnitId: null,
          type: lessonQuestTarget.type,
          questDateUtc: dayStartDb,
        }),
      );
    }

    const existingDailyCount = normalizedExistingQuests.filter(
      (quest) => quest.type !== QuestTypeValues.masterDailyQuests,
    ).length;
    const draftedDailyCount = drafts.filter(
      (draft) => getQuestDefinition(draft.type).tier === 'daily',
    ).length;
    const totalDailyQuestCount = existingDailyCount + draftedDailyCount;
    const masterQuestReward =
      this.calculateBaseMasterQuestReward(totalDailyQuestCount);
    const existingMasterQuest = normalizedExistingQuests.find(
      (quest) => quest.type === QuestTypeValues.masterDailyQuests,
    );
    const shouldReconcileExistingMasterReward =
      totalDailyQuestCount > 0 &&
      existingMasterQuest !== undefined &&
      !existingMasterQuest.isCompleted &&
      existingMasterQuest.expGranted !== masterQuestReward;

    if (
      totalDailyQuestCount > 0 &&
      !existingTypes.has(QuestTypeValues.masterDailyQuests)
    ) {
      drafts.push(
        this.buildQuestDraft({
          userId,
          moduleId: null,
          moduleUnitId: null,
          type: QuestTypeValues.masterDailyQuests,
          expGranted: masterQuestReward,
          questDateUtc: dayStartDb,
        }),
      );
    }

    if (drafts.length === 0 && !shouldReconcileExistingMasterReward) {
      return;
    }

    if (shouldReconcileExistingMasterReward) {
      // Existing quest days can gain another daily quest later in the day, so the unclaimed master reward must stay aligned.
      await prismaClient.dailyQuest.update({
        where: {
          id: existingMasterQuest.id,
        },
        data: {
          expGranted: masterQuestReward,
        },
      });
    }

    if (drafts.length === 0) {
      return;
    }

    // Unique indexes plus skipDuplicates keep quest generation safe when reads race on the same UTC day.
    await prismaClient.dailyQuest.createMany({
      data: drafts,
      skipDuplicates: true,
    });
  }

  // Constructs a quest draft with a default XP reward pulled from the shared quest definition, unless an explicit override is provided.
  // The override is used for master quests whose reward varies with the daily quest count.
  private buildQuestDraft(input: {
    userId: number;
    moduleId: number | null;
    moduleUnitId: number | null;
    type: QuestType;
    expGranted?: number;
    questDateUtc: Date;
  }): GeneratedQuestDraft {
    return {
      userId: input.userId,
      moduleId: input.moduleId,
      moduleUnitId: input.moduleUnitId,
      type: input.type,
      expGranted: input.expGranted ?? getQuestDefinition(input.type).expReward,
      questDateUtc: input.questDateUtc,
    };
  }

  // Delegates availability checks to the dedicated service so quest generation stays decoupled from daily-practice set rules.
  private async selectAllAvailableDailyPracticeModuleIds(input: {
    userId: number;
    enrolledModuleIds: number[];
    timestamp: Date;
    timezone: string;
  }): Promise<number[]> {
    return this.questDailyPracticeAvailabilityService.findAllAvailableModuleIds(
      input.userId,
      input.enrolledModuleIds,
      input.timestamp,
      input.timezone,
    );
  }

  private calculateBaseMasterQuestReward(totalDailyQuestCount: number): number {
    const missingDailyQuestCount = Math.max(
      0,
      MAX_DAILY_QUEST_COUNT - totalDailyQuestCount,
    );

    // Missing quest slots are folded into the master reward so the daily quest XP budget stays stable on "all caught up" days.
    return (
      MASTER_QUEST_COMPLETION_REWARD +
      missingDailyQuestCount * QUEST_COMPLETION_REWARD
    );
  }

  // Returns only active student memberships — archived modules are excluded so quests are never generated for inaccessible content.
  private async listEnrolledModuleIds(
    userId: number,
    prismaClient: PrismaClientLike,
  ): Promise<number[]> {
    const memberships = await prismaClient.userModule.findMany({
      where: {
        userId,
        roleInModule: 'student',
        module: { archivedAt: null },
      },
      orderBy: {
        moduleId: 'asc',
      },
      select: {
        moduleId: true,
      },
    });

    return memberships.map((membership) => membership.moduleId);
  }

  // Finds the module of the student's earliest prior-day completed unit.
  // Returning null when no qualifying completion exists prevents quests being generated on the day of a student's very first lesson.
  private async selectCompletedUnitTarget(
    userId: number,
    moduleIds: number[],
    questDayStartUtc: Date,
    prismaClient: PrismaClientLike,
  ): Promise<ModuleQuestTarget | null> {
    const completedUnit = await prismaClient.moduleUnitUserProgress.findFirst({
      where: {
        studentId: userId,
        isCompleted: true,
        completedAt: {
          lt: questDayStartUtc,
        },
        moduleUnit: {
          moduleId: {
            in: moduleIds,
          },
        },
      },
      orderBy: [{ completedAt: 'asc' }, { moduleUnitId: 'asc' }],
      select: {
        moduleUnit: {
          select: {
            moduleId: true,
          },
        },
      },
    });

    if (!completedUnit?.moduleUnit?.moduleId) {
      return null;
    }

    return {
      moduleId: completedUnit.moduleUnit.moduleId,
    };
  }

  // Selects a lesson quest target using a two-tier priority: a new uncompleted unit is preferred (completeNewUnit),
  // falling back to a completed unit with active questions (moduleUnitRetry).
  // The retry branch is suppressed when higher-importance daily practice quests are available.
  private async selectLessonQuestTarget(
    userId: number,
    moduleIds: number[],
    prismaClient: PrismaClientLike,
    suppressRetry: boolean = false,
  ): Promise<(ModuleQuestTarget & { type: QuestType }) | null> {
    const newUnitTarget = await prismaClient.moduleUnit.findFirst({
      where: {
        moduleId: {
          in: moduleIds,
        },
        status: 'live',
        // Student-facing unit cards derive question count from active questions, so quest generation must use the same source of truth.
        questionUnits: {
          some: {
            isArchived: false,
          },
        },
        userProgress: {
          none: {
            studentId: userId,
            isCompleted: true,
          },
        },
      },
      orderBy: [{ moduleId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        moduleId: true,
      },
    });

    if (newUnitTarget) {
      return {
        type: QuestTypeValues.completeNewUnit,
        moduleId: newUnitTarget.moduleId as number,
      };
    }

    // module_unit_retry has lower importance — skip it when daily practice (highest importance) is available.
    if (suppressRetry) {
      return null;
    }

    const retryTarget = await prismaClient.moduleUnitUserProgress.findFirst({
      where: {
        studentId: userId,
        isCompleted: true,
        moduleUnit: {
          moduleId: {
            in: moduleIds,
          },
          status: 'live',
          // Retry quests should also ignore stale denormalized counts and require at least one active question.
          questionUnits: {
            some: {
              isArchived: false,
            },
          },
        },
      },
      orderBy: [{ completedAt: 'asc' }, { moduleUnitId: 'asc' }],
      select: {
        moduleUnit: {
          select: {
            moduleId: true,
          },
        },
      },
    });

    if (!retryTarget?.moduleUnit?.moduleId) {
      return null;
    }

    return {
      type: QuestTypeValues.moduleUnitRetry,
      moduleId: retryTarget.moduleUnit.moduleId,
    };
  }
}
