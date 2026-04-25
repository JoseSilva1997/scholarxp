// ModuleService now enforces creator scoping and role-aware queries to keep module data isolated.
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../types/auth-user.type';
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
    // Validate institution scoping. Throws if institution_admins try to create
    // modules outside their institution, or if teachers try to create modules
    // for institutions they don't belong to.
    await this.validateInstitutionScope(
      user.id,
      user.globalRole,
      createModuleDto.institutionId,
    );

    const data = {
      ...createModuleDto,
      createdByUserId: user.id,
    };

    return this.prisma.module.create({ data });
  }

  async findAll(user: AuthUser) {
    // If admin or teacher, use simple filter; institution admins need async load.
    const filter = this.getModuleAccessFilter(user);

    if (filter !== null) {
      return this.prisma.module.findMany({
        where: this.withActiveModuleFilter(filter),
      });
    }

    // Institution admin: load institutions first, then filter by them.
    const institutions = await this.prisma.ltiIdentity.findMany({
      where: { userId: user.id },
      select: { institutionId: true },
    });
    const institutionIds = institutions.map((i) => i.institutionId);

    return this.prisma.module.findMany({
      where: {
        institutionId: { in: institutionIds },
        archivedAt: null,
      },
    });
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
    await this.getOrThrow(id);

    await this.validateInstitutionScope(
      user.id,
      user.globalRole,
      updateModuleDto.institutionId,
    );
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

  private async assertInstitutionMembership(
    userId: number,
    institutionId: number,
  ) {
    const membership = await this.prisma.ltiIdentity.findFirst({
      where: { userId, institutionId },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        'User is not part of the target institution',
      );
    }
  }

  // Helper: Build WHERE clause based on user role for findAll queries.
  // This isolates role-aware scoping logic so it's easy to test and reuse.
  private getModuleAccessFilter(user: AuthUser) {
    if (user.globalRole === GlobalRole.admin) {
      return {}; // Admins see all
    }
    if (user.globalRole === GlobalRole.institution_admin) {
      // Institution admins see only their institution's modules (loaded async below)
      return null; // Signals we need to load institutions first
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
    // Students: only enrolled modules
    return {
      userModules: { some: { userId: user.id, roleInModule: 'student' } },
    };
  }

  private withActiveModuleFilter(filter: object) {
    if (Object.keys(filter).length === 0) {
      return { archivedAt: null };
    }
    return {
      AND: [filter, { archivedAt: null }],
    };
  }

  // Helper: Validate that institution_admin users provide an institution and have membership.
  // Prevents repeated validation logic in create/update.
  // - Institution admins must always specify an institution they belong to.
  // - Teachers can only create/update modules for institutions they belong to.
  private async validateInstitutionScope(
    userId: number,
    globalRole: GlobalRole,
    institutionId: number | undefined | null,
  ): Promise<void> {
    if (globalRole === GlobalRole.institution_admin) {
      if (!institutionId) {
        throw new ForbiddenException(
          'Institution admins must tie modules to their institution',
        );
      }
      // Institution admins must belong to the institution they're managing.
      await this.assertInstitutionMembership(userId, institutionId);
    }

    // Teachers must validate membership if an institution is provided.
    if (
      globalRole === GlobalRole.teacher &&
      institutionId !== undefined &&
      institutionId !== null
    ) {
      await this.assertInstitutionMembership(userId, institutionId);
    }
  }
}
