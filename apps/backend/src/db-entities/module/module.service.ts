// ModuleService now enforces creator scoping and role-aware queries to keep module data isolated.
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../auth/auth.service';
import { GlobalRole } from '@prisma/client';

@Injectable()
export class ModuleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createModuleDto: CreateModuleDto, user: AuthUser) {
    // Enforce that the creator is recorded and institution scoping is respected.
    const data = {
      ...createModuleDto,
      createdByUserId: user.id,
    };

    if (user.globalRole === GlobalRole.institution_admin) {
      if (!data.institutionId) {
        throw new ForbiddenException(
          'Institution admins must tie modules to their institution',
        );
      }
      await this.assertInstitutionMembership(user.id, data.institutionId);
    }

    if (
      user.globalRole === GlobalRole.teacher &&
      data.institutionId !== undefined &&
      data.institutionId !== null
    ) {
      await this.assertInstitutionMembership(user.id, data.institutionId);
    }

    return this.prisma.module.create({ data });
  }

  async findAll(user: AuthUser) {
    // Filter modules by the caller's scope; admins see everything.
    if (user.globalRole === GlobalRole.admin) {
      return this.prisma.module.findMany();
    }

    if (user.globalRole === GlobalRole.institution_admin) {
      const institutions = await this.prisma.ltiIdentity.findMany({
        where: { userId: user.id },
        select: { institutionId: true },
      });
      const institutionIds = institutions.map((i) => i.institutionId);
      return this.prisma.module.findMany({
        where: { institutionId: { in: institutionIds } },
      });
    }

    if (user.globalRole === GlobalRole.teacher) {
      return this.prisma.module.findMany({
        where: {
          OR: [
            { createdByUserId: user.id },
            {
              userModules: {
                some: { userId: user.id, roleInModule: 'teacher' },
              },
            },
          ],
        },
      });
    }

    // Students: only modules they are enrolled in.
    return this.prisma.module.findMany({
      where: {
        userModules: { some: { userId: user.id, roleInModule: 'student' } },
      },
    });
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateModuleDto: UpdateModuleDto, user: AuthUser) {
    await this.getOrThrow(id);
    if (
      user.globalRole === GlobalRole.institution_admin &&
      updateModuleDto.institutionId
    ) {
      await this.assertInstitutionMembership(
        user.id,
        updateModuleDto.institutionId,
      );
    }
    return this.prisma.module.update({
      where: { id },
      data: updateModuleDto,
    });
  }

  async remove(id: number) {
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
}
