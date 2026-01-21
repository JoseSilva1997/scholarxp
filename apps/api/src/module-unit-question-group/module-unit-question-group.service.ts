import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleUnitQuestionGroupDto } from './dto/create-module-unit-question-group.dto';
import { UpdateModuleUnitQuestionGroupDto } from './dto/update-module-unit-question-group.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModuleUnitQuestionGroupService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleUnitQuestionGroupDto: CreateModuleUnitQuestionGroupDto) {
    return this.prisma.moduleUnitQuestionGroup.create({ data: createModuleUnitQuestionGroupDto });
  }

  findAll() {
    return this.prisma.moduleUnitQuestionGroup.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateModuleUnitQuestionGroupDto: UpdateModuleUnitQuestionGroupDto) {
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

  private async getOrThrow(id: number) {
    const record = await this.prisma.moduleUnitQuestionGroup.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`ModuleUnitQuestionGroup ${id} not found`);
    }
    return record;
  }
}
