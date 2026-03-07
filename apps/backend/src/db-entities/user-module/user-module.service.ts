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
import { MODULE_UNIT_BASELINE_EXP } from '@scholarxp/constants';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UserModuleService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserModuleDto: CreateUserModuleDto) {
    return this.prisma.userModule.create({ data: createUserModuleDto });
  }

  findAll(moduleId: number | undefined) {
    // Constrain roster queries to a specific module when provided.
    if (moduleId) {
      return this.prisma.userModule.findMany({ where: { moduleId } });
    }
    return this.prisma.userModule.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateUserModuleDto: UpdateUserModuleDto) {
    await this.getOrThrow(id);
    return this.prisma.userModule.update({
      where: { id },
      data: updateUserModuleDto,
    });
  }

  async remove(id: number) {
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
        userModuleLevel: true,
      },
    });

    if (!membership) {
      throw new NotFoundException(
        `The student is not enrolled in this module.`,
      );
    }

    const totalExp = membership.currentExp + expGained;
    const levelGain = Math.floor(totalExp / MODULE_UNIT_BASELINE_EXP);
    const remainingExp = totalExp % MODULE_UNIT_BASELINE_EXP;

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
      throw new NotFoundException(`UserModule not found`);
    }
    return record;
  }
}
