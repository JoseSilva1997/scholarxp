// UserModuleService handles roster records; it now supports module-scoped listing.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CreateUserModuleDto } from './dto/create-user-module.dto';
import { UpdateUserModuleDto } from './dto/update-user-module.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../types/auth-user.type';
import { assertHasAccess } from '../../helpers/permissions.helper';
import { MODULE_EXP_MAX } from '@scholarxp/constants';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UserModuleService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserModuleDto: CreateUserModuleDto, user: AuthUser) {
    // Validate permissisons before hitting the database so we fail fast on forbidden requests.
    assertHasAccess(
      'modules.settings',
      user,
      'You do not have permission to manage module rosters.',
    );
    return this.prisma.userModule.create({ data: createUserModuleDto });
  }

  findAll(moduleId: number | undefined, user: AuthUser) {
    assertHasAccess(
      'modules.settings',
      user,
      'You do not have permission to manage module rosters.',
    );
    // Constrain roster queries to a specific module when provided.
    if (moduleId) {
      return this.prisma.userModule.findMany({ where: { moduleId } });
    }
    return this.prisma.userModule.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(
    id: number,
    updateUserModuleDto: UpdateUserModuleDto,
    user: AuthUser,
  ) {
    assertHasAccess(
      'modules.settings',
      user,
      'You do not have permission to manage module rosters.',
    );
    await this.getOrThrow(id);
    return this.prisma.userModule.update({
      where: { id },
      data: updateUserModuleDto,
    });
  }

  async remove(id: number, user: AuthUser) {
    assertHasAccess(
      'modules.settings',
      user,
      'You do not have permission to delete module rosters.',
    );
    await this.getOrThrow(id);
    return this.prisma.userModule.delete({ where: { id } });
  }

  // Practice-room rewards increment module XP here so module-progress mutation rules stay centralized.
  async addStudentModuleExp(
    moduleId: number,
    studentId: number,
    expGained: number,
    tx?: PrismaClientLike,
  ) {
    if (expGained <= 0) {
      throw new BadRequestException(
        'Module experience gain must be greater than zero.',
      );
    }

    const prismaClient = tx ?? this.prisma;
    const membership = await prismaClient.userModule.findUnique({
      where: {
        moduleId_userId: {
          moduleId,
          userId: studentId,
        },
      },
      select: {
        id: true,
        currentExp: true,
        userModuleLevel: true
      },
    });

    if (!membership) {
      throw new NotFoundException(
        `Student ${studentId} is not enrolled in module ${moduleId}.`,
      );
    }

    const totalExp = membership.currentExp + expGained;
    const levelGain = Math.floor(totalExp / MODULE_EXP_MAX);
    const remainingExp = totalExp % MODULE_EXP_MAX;

    return prismaClient.userModule.update({
      where: { id: membership.id },
      data: {
        currentExp: {
          set: remainingExp,
        },
        userModuleLevel: {
          set: membership.userModuleLevel + levelGain,
        },
      },
    });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.userModule.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`UserModule ${id} not found`);
    }
    return record;
  }
}
