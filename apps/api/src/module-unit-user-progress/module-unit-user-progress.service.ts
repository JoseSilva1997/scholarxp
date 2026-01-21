import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleUnitUserProgressDto } from './dto/create-module-unit-user-progress.dto';
import { UpdateModuleUnitUserProgressDto } from './dto/update-module-unit-user-progress.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModuleUnitUserProgressService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleUnitUserProgressDto: CreateModuleUnitUserProgressDto) {
    return this.prisma.moduleUnitUserProgress.create({ data: createModuleUnitUserProgressDto });
  }

  findAll() {
    return this.prisma.moduleUnitUserProgress.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateModuleUnitUserProgressDto: UpdateModuleUnitUserProgressDto) {
    await this.getOrThrow(id);
    return this.prisma.moduleUnitUserProgress.update({
      where: { id },
      data: updateModuleUnitUserProgressDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.moduleUnitUserProgress.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.moduleUnitUserProgress.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`ModuleUnitUserProgress ${id} not found`);
    }
    return record;
  }
}
