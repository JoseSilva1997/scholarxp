import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleUnitQuestionGroupDto } from './dto/create-module-unit-question-group.dto';
import { UpdateModuleUnitQuestionGroupDto } from './dto/update-module-unit-question-group.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ModuleUnitQuestionGroupService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleUnitQuestionGroupDto: CreateModuleUnitQuestionGroupDto) {
    return this.prisma.moduleUnitQuestionGroup.create({
      data: createModuleUnitQuestionGroupDto,
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
      group.moduleUnitId !== moduleUnitId ||
      group.moduleUnit?.moduleId !== moduleId
    ) {
      throw new NotFoundException('Question group not found');
    }

    // Delete questions in this group first to avoid leaving orphans; cascades handle contents/variants.
    await this.prisma.questionUnit.deleteMany({
      where: { questionGroupId: groupId, moduleUnitId },
    });

    return this.prisma.moduleUnitQuestionGroup.delete({ where: { id: groupId } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.moduleUnitQuestionGroup.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException(`ModuleUnitQuestionGroup ${id} not found`);
    }
    return record;
  }
}
