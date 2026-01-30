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
import { GlobalRole } from '@prisma/client';
import { assertHasAccess } from '../../helpers/permissions.helper';

@Injectable()
export class ModuleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createModuleDto: CreateModuleDto, user: AuthUser) {
    // Enforce shared permission matrix first so backend and frontend rules stay aligned.
    assertHasAccess(
      'modules.create',
      user,
      'You do not have permission to create modules',
    );

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
      return this.prisma.module.findMany({ where: filter });
    }

    // Institution admin: load institutions first, then filter by them.
    const institutions = await this.prisma.ltiIdentity.findMany({
      where: { userId: user.id },
      select: { institutionId: true },
    });
    const institutionIds = institutions.map((i) => i.institutionId);

    return this.prisma.module.findMany({
      where: { institutionId: { in: institutionIds } },
    });
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateModuleDto: UpdateModuleDto, user: AuthUser) {
    assertHasAccess('modules.settings', user);

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
    assertHasAccess('modules.settings', user);

    await this.getOrThrow(id);
    return this.prisma.module.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const module = await this.prisma.module.findUnique({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module ${id} not found`);
    }
    return module;
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
