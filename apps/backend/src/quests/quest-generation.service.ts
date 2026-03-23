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
    const { dayStartUtc } = DateHelpers.getUtcDayBounds(timestamp);
    const existingQuests = await prismaClient.dailyQuest.findMany({
      where: {
        userId,
        questDateUtc: dayStartUtc,
      },
      select: {
        id: true,
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
        type: quest.type as QuestType,
        expGranted: quest.expGranted,
        isCompleted: quest.isCompleted,
      }),
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
      dayStartUtc,
      prismaClient,
    );
    // Product rule: quests unlock only after the student has both joined a module and
    // completed at least one lesson on a previous UTC day, so same-day completions never
    // retroactively create quests before the next rollover.
    if (!completedUnitTarget) {
      return;
    }

    const lessonQuestTarget = hasLessonQuest
      ? null
      : await this.selectLessonQuestTarget(
          userId,
          enrolledModuleIds,
          prismaClient,
        );
    const dailyPracticeTargetModuleId =
      await this.selectDailyPracticeTargetModuleId({
        userId,
        enrolledModuleIds,
        preferredModuleIds: [
          lessonQuestTarget?.moduleId ?? null,
          completedUnitTarget.moduleId,
        ],
        timestamp,
      });

    const drafts: GeneratedQuestDraft[] = [];
    if (
      dailyPracticeTargetModuleId !== null &&
      !existingTypes.has(QuestTypeValues.completeDailyPractice)
    ) {
      drafts.push(
        this.buildQuestDraft({
          userId,
          moduleId: dailyPracticeTargetModuleId,
          moduleUnitId: null,
          type: QuestTypeValues.completeDailyPractice,
          questDateUtc: dayStartUtc,
        }),
      );
    }
    if (
      dailyPracticeTargetModuleId !== null &&
      !existingTypes.has(QuestTypeValues.dailyPracticeStreak)
    ) {
      drafts.push(
        this.buildQuestDraft({
          userId,
          moduleId: dailyPracticeTargetModuleId,
          moduleUnitId: null,
          type: QuestTypeValues.dailyPracticeStreak,
          questDateUtc: dayStartUtc,
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
          questDateUtc: dayStartUtc,
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
          questDateUtc: dayStartUtc,
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

  private async selectDailyPracticeTargetModuleId(input: {
    userId: number;
    enrolledModuleIds: number[];
    preferredModuleIds: Array<number | null>;
    timestamp: Date;
  }): Promise<number | null> {
    const seenModuleIds = new Set<number>();
    const orderedCandidateModuleIds = [
      ...input.preferredModuleIds,
      ...input.enrolledModuleIds,
    ].filter((moduleId): moduleId is number => {
      if (moduleId === null || seenModuleIds.has(moduleId)) {
        return false;
      }

      seenModuleIds.add(moduleId);
      return true;
    });

    return this.questDailyPracticeAvailabilityService.findFirstAvailableModuleId(
      input.userId,
      orderedCandidateModuleIds,
      input.timestamp,
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

  private async listEnrolledModuleIds(
    userId: number,
    prismaClient: PrismaClientLike,
  ): Promise<number[]> {
    const memberships = await prismaClient.userModule.findMany({
      where: {
        userId,
        roleInModule: 'student',
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

  private async selectLessonQuestTarget(
    userId: number,
    moduleIds: number[],
    prismaClient: PrismaClientLike,
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
