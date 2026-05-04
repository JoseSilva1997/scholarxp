// Service for module lifecycle management. Access is role-scoped: admins see all modules,
// teachers see modules they own or are enrolled in as teacher, students see only their enrolled modules.
// Deletion is a two-stage soft-delete: archive first, then permanent purge after the grace period.
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '@scholarxp/api-contracts';
import { GlobalRole, Prisma } from '@prisma/client';
import { DailyPracticeService } from '../../daily-practice/daily-practice.service';
import type { ModuleDeletionImpactResponse } from '@scholarxp/api-contracts';

const ARCHIVED_MODULE_PURGE_DELAY_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyPracticeService: DailyPracticeService,
  ) {}

  async create(createModuleDto: CreateModuleDto, user: AuthUser) {
    const data = {
      ...createModuleDto,
      createdByUserId: user.id,
    };

    return this.prisma.module.create({ data });
  }

  async findAll(user: AuthUser) {
    const filter = this.getModuleAccessFilter(user);
    const modules = await this.prisma.module.findMany({
      where: this.withActiveModuleFilter(filter),
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });

    return modules.map(({ createdBy, ...module }) => ({
      ...module,
      createdByName: createdBy
        ? `${createdBy.firstName} ${createdBy.lastName}`
        : null,
    }));
  }

  async findOne(id: number, user?: AuthUser) {
    const module = await this.getOrThrow(id);

    // When the caller is a student, attach their module-scoped progression and daily practice status.
    if (user?.globalRole === GlobalRole.student) {
      const [progress, dailyPractice] = await Promise.all([
        this.prisma.userModule.findUnique({
          where: { moduleId_userId: { moduleId: id, userId: user.id } },
          select: { userModuleLevel: true, currentExp: true },
        }),
        this.dailyPracticeService.getDailyPracticeStatus(id, user.id),
      ]);

      return {
        ...module,
        ...(progress && {
          userModuleLevel: progress.userModuleLevel,
          currentExp: progress.currentExp,
        }),
        dailyPractice,
      };
    }

    return module;
  }

  async update(id: number, updateModuleDto: UpdateModuleDto, user: AuthUser) {
    // Keep user in the signature for consistency with guarded service methods and future audit hooks.
    void user;
    await this.getOrThrow(id);

    return this.prisma.module.update({
      where: { id },
      data: updateModuleDto,
    });
  }

  async remove(id: number, user: AuthUser) {
    // Keep user in the signature for consistency with other service methods and future audit hooks.
    void user;
    const module = await this.getOrThrow(id, { includeArchived: true });
    if (module.archivedAt) {
      return module;
    }

    return this.prisma.module.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  // Returns a pre-deletion impact summary so the UI can warn the instructor before they confirm.
  // Also determines whether the module is eligible for immediate hard-delete (no learner data).
  async getDeletionImpact(
    id: number,
    referenceDate: Date = new Date(),
  ): Promise<ModuleDeletionImpactResponse> {
    const module = await this.getOrThrow(id, { includeArchived: true });
    const counts = await this.getDeletionImpactCounts(id, this.prisma);
    const isPurgeableArchivedModule =
      module.archivedAt !== null &&
      this.getPurgeEligibleAt(module.archivedAt) <= referenceDate &&
      this.hasNoLearnerImpact(counts);

    return {
      moduleId: id,
      isArchived: module.archivedAt !== null,
      willArchive: true,
      isPurgeableArchivedModule,
      purgeEligibleAt: module.archivedAt
        ? this.getPurgeEligibleAt(module.archivedAt).toISOString()
        : null,
      counts,
    };
  }

  // Checks whether an archived module can be permanently deleted: it must be past the grace period
  // and have zero learner-associated data. Accepts a transaction client for use inside purge loops.
  async isPurgeableArchivedModule(
    id: number,
    referenceDate: Date = new Date(),
    prismaClient: PrismaClientLike = this.prisma,
  ): Promise<boolean> {
    const module = await prismaClient.module.findUnique({
      where: { id },
      select: { archivedAt: true },
    });
    if (!module?.archivedAt) {
      return false;
    }

    if (this.getPurgeEligibleAt(module.archivedAt) > referenceDate) {
      return false;
    }

    const counts = await this.getDeletionImpactCounts(id, prismaClient);
    return this.hasNoLearnerImpact(counts);
  }

  // Iterates all archived modules past the grace period and hard-deletes those with no learner impact.
  // Each deletion runs in its own transaction so a single failure does not abort the entire sweep.
  async purgeEligibleArchivedModules(
    referenceDate: Date = new Date(),
  ): Promise<{ purgedModuleCount: number }> {
    const cutoffDate = new Date(
      referenceDate.getTime() - ARCHIVED_MODULE_PURGE_DELAY_DAYS * DAY_IN_MS,
    );
    const candidates = await this.prisma.module.findMany({
      where: {
        archivedAt: {
          not: null,
          lte: cutoffDate,
        },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    let purgedModuleCount = 0;
    for (const candidate of candidates) {
      const didPurge = await this.prisma.$transaction(async (tx) => {
        const purgeable = await this.isPurgeableArchivedModule(
          candidate.id,
          referenceDate,
          tx,
        );
        if (!purgeable) {
          return false;
        }

        await tx.module.delete({ where: { id: candidate.id } });
        return true;
      });
      if (didPurge) {
        purgedModuleCount += 1;
      }
    }

    return { purgedModuleCount };
  }

  private async getOrThrow(
    id: number,
    options: { includeArchived?: boolean } = {},
  ) {
    const module = await this.prisma.module.findUnique({ where: { id } });
    if (!module || (!options.includeArchived && module.archivedAt)) {
      throw new NotFoundException(`Module ${id} not found`);
    }
    return module;
  }

  private async getDeletionImpactCounts(
    moduleId: number,
    prismaClient: PrismaClientLike,
  ): Promise<ModuleDeletionImpactResponse['counts']> {
    const [
      studentEnrollments,
      attempts,
      expLedgerEntries,
      moduleUnitProgress,
      studentQuestionStates,
      dailyPracticeSets,
      dailyPracticeSetItems,
      dailyQuests,
      invites,
      moduleUnits,
      questions,
    ] = await Promise.all([
      prismaClient.userModule.count({
        where: { moduleId, roleInModule: 'student' },
      }),
      prismaClient.questionAttempt.count({
        where: { moduleUnit: { moduleId } },
      }),
      prismaClient.expLedger.count({
        where: {
          OR: [{ moduleId }, { moduleUnit: { moduleId } }],
        },
      }),
      prismaClient.moduleUnitUserProgress.count({
        where: { moduleUnit: { moduleId } },
      }),
      prismaClient.studentQuestionState.count({ where: { moduleId } }),
      prismaClient.dailyPracticeSet.count({ where: { moduleId } }),
      prismaClient.dailyPracticeSetItem.count({
        where: { moduleUnit: { moduleId } },
      }),
      prismaClient.dailyQuest.count({ where: { moduleId } }),
      prismaClient.moduleInvite.count({ where: { moduleId } }),
      prismaClient.moduleUnit.count({ where: { moduleId } }),
      prismaClient.questionUnit.count({ where: { moduleUnit: { moduleId } } }),
    ]);

    return {
      studentEnrollments,
      attempts,
      expLedgerEntries,
      moduleUnitProgress,
      studentQuestionStates,
      dailyPracticeSets,
      dailyPracticeSetItems,
      dailyQuests,
      invites,
      moduleUnits,
      questions,
    };
  }

  private getPurgeEligibleAt(archivedAt: Date): Date {
    return new Date(
      archivedAt.getTime() + ARCHIVED_MODULE_PURGE_DELAY_DAYS * DAY_IN_MS,
    );
  }

  private hasNoLearnerImpact(
    counts: ModuleDeletionImpactResponse['counts'],
  ): boolean {
    return (
      counts.studentEnrollments === 0 &&
      counts.attempts === 0 &&
      counts.expLedgerEntries === 0 &&
      counts.moduleUnitProgress === 0 &&
      counts.studentQuestionStates === 0 &&
      counts.dailyPracticeSets === 0 &&
      counts.dailyPracticeSetItems === 0 &&
      counts.dailyQuests === 0
    );
  }

  // Builds a Prisma `where` fragment that scopes the module list to what the caller is permitted to see.
  // Strategy pattern: admin returns empty filter (no restriction), teacher returns OR of owned + enrolled,
  // student returns only their enrolled modules.
  private getModuleAccessFilter(user: AuthUser) {
    if (user.globalRole === GlobalRole.admin) {
      return {};
    }

    if (user.globalRole === GlobalRole.teacher) {
      return {
        OR: [
          { createdByUserId: user.id },
          {
            userModules: {
              some: { userId: user.id, roleInModule: 'teacher' },
            },
          },
        ],
      };
    }
    return {
      userModules: { some: { userId: user.id, roleInModule: 'student' } },
    };
  }

  // Combines the role-based access filter with the archivedAt:null guard so all list reads
  // automatically exclude archived modules without callers having to remember to add the clause.
  private withActiveModuleFilter(filter: object) {
    if (Object.keys(filter).length === 0) {
      return { archivedAt: null };
    }
    return {
      AND: [filter, { archivedAt: null }],
    };
  }
}
