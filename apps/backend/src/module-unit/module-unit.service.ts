import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleUnitDto } from './dto/create-module-unit.dto';
import { UpdateModuleUnitDto } from './dto/update-module-unit.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModuleUnitService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleUnitDto: CreateModuleUnitDto) {
    return this.prisma.moduleUnit.create({ data: createModuleUnitDto });
  }

  findAll() {
    return this.prisma.moduleUnit.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateModuleUnitDto: UpdateModuleUnitDto) {
    await this.getOrThrow(id);
    return this.prisma.moduleUnit.update({
      where: { id },
      data: updateModuleUnitDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.moduleUnit.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.moduleUnit.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`ModuleUnit ${id} not found`);
    }
    return record;
  }
}
