import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ModuleService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleDto: CreateModuleDto) {
    return this.prisma.module.create({ data: createModuleDto });
  }

  findAll() {
    return this.prisma.module.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateModuleDto: UpdateModuleDto) {
    await this.getOrThrow(id);
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
}
