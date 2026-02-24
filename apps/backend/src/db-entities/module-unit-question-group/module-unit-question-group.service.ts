import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleUnitStatus, Prisma } from '@prisma/client';
import { CreateModuleUnitQuestionGroupDto } from './dto/create-module-unit-question-group.dto';
import { UpdateModuleUnitQuestionGroupDto } from './dto/update-module-unit-question-group.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ModuleUnitQuestionGroupService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleUnitQuestionGroupDto: CreateModuleUnitQuestionGroupDto) {
    return this.prisma.moduleUnitQuestionGroup.create({
      data: {
        ...createModuleUnitQuestionGroupDto,
        // New groups are active by default; archiving is an explicit author action.
        isArchived: false,
      },
    });
  }

  // Create a new group ensuring the target module-unit belongs to the specified module.
  async createScoped(
    moduleId: number,
    moduleUnitId: number,
    dto: CreateModuleUnitQuestionGroupDto,
  ) {
    const unit = await this.prisma.moduleUnit.findUnique({
      where: { id: moduleUnitId },
      select: { id: true, moduleId: true },
    });

    if (!unit || unit.moduleId !== moduleId) {
      throw new NotFoundException('Module unit not found');
    }

    if (dto.moduleUnitId !== moduleUnitId) {
      throw new BadRequestException('moduleUnitId mismatch');
    }

    // Verify name uniqueness within the same unit before creation.
    const duplicate = await this.prisma.moduleUnitQuestionGroup.findFirst({
      where: {
        moduleUnitId,
        isArchived: false,
        name: dto.name.trim(),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'A question group with this name already exists in this module unit',
      );
    }

    return this.prisma.moduleUnitQuestionGroup.create({
      data: {
        ...dto,
        name: dto.name.trim(),
        isArchived: false,
      },
    });
  }

  findAll() {
    return this.prisma.moduleUnitQuestionGroup.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(
    id: number,
    updateModuleUnitQuestionGroupDto: UpdateModuleUnitQuestionGroupDto,
  ) {
    await this.getOrThrow(id);
    return this.prisma.moduleUnitQuestionGroup.update({
      where: { id },
      data: updateModuleUnitQuestionGroupDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.moduleUnitQuestionGroup.delete({ where: { id } });
  }

  // Remove a group and all questions within the same module/unit scope.
  async removeScoped(moduleId: number, moduleUnitId: number, groupId: number) {
    const group = await this.prisma.moduleUnitQuestionGroup.findUnique({
      where: { id: groupId },
      include: { moduleUnit: true },
    });

    if (
      !group ||
      group.isArchived ||
      group.moduleUnitId !== moduleUnitId ||
      group.moduleUnit?.moduleId !== moduleId
    ) {
      throw new NotFoundException('Question group not found');
    }

    const hasAttempts = await this.prisma.questionAttempt.count({
      where: {
        moduleUnitId,
        question: {
          questionGroupId: groupId,
          moduleUnitId,
        },
      },
    });
    const shouldArchive =
      group.moduleUnit?.status === ModuleUnitStatus.live || hasAttempts > 0;

    if (!shouldArchive) {
      // Draft units without attempts can still hard delete safely.
      await this.prisma.questionUnit.deleteMany({
        where: { questionGroupId: groupId, moduleUnitId },
      });
      return this.prisma.moduleUnitQuestionGroup.delete({
        where: { id: groupId },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Archive instead of deleting so existing attempts remain historically valid.
      await tx.questionUnit.updateMany({
        where: { questionGroupId: groupId, moduleUnitId },
        data: { isArchived: true },
      });
      await tx.questionContent.updateMany({
        where: {
          questionUnit: {
            moduleUnitId,
            questionGroupId: groupId,
          },
        },
        data: { isArchived: true },
      });
      return tx.moduleUnitQuestionGroup.update({
        where: { id: groupId },
        data: { isArchived: true },
      });
    });
  }

  // Rename a group within module/unit scope so author actions stay tenant-safe.
  async renameScoped(
    moduleId: number,
    moduleUnitId: number,
    groupId: number,
    rawName: string,
  ) {
    const group = await this.prisma.moduleUnitQuestionGroup.findUnique({
      where: { id: groupId },
      include: { moduleUnit: true },
    });

    if (
      !group ||
      group.isArchived ||
      group.moduleUnitId !== moduleUnitId ||
      group.moduleUnit?.moduleId !== moduleId
    ) {
      throw new NotFoundException('Question group not found');
    }

    // Normalize whitespace to keep labels consistent across cards/editor panes.
    const nextName = rawName.trim();
    if (!nextName) {
      throw new BadRequestException('Question group name cannot be empty');
    }

    // Ignore archived groups when checking duplicate names so archived labels can be reused.
    const duplicate = await this.prisma.moduleUnitQuestionGroup.findFirst({
      where: {
        moduleUnitId,
        isArchived: false,
        name: nextName,
        id: { not: groupId },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'A question group with this name already exists in this module unit',
      );
    }

    try {
      return await this.prisma.moduleUnitQuestionGroup.update({
        where: { id: groupId },
        data: { name: nextName },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A question group with this name already exists in this module unit',
        );
      }
      throw error;
    }
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.moduleUnitQuestionGroup.findUnique({
      where: { id },
    });
    if (!record || record.isArchived) {
      throw new NotFoundException(`ModuleUnitQuestionGroup ${id} not found`);
    }
    return record;
  }
}
