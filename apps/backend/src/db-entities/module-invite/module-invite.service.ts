import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleInviteDto } from './dto/create-module-invite.dto';
import { UpdateModuleInviteDto } from './dto/update-module-invite.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ModuleInviteService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleInviteDto: CreateModuleInviteDto) {
    return this.prisma.moduleInvite.create({ data: createModuleInviteDto });
  }

  findAll() {
    return this.prisma.moduleInvite.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(id: number, updateModuleInviteDto: UpdateModuleInviteDto) {
    await this.getOrThrow(id);
    return this.prisma.moduleInvite.update({
      where: { id },
      data: updateModuleInviteDto,
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    return this.prisma.moduleInvite.delete({ where: { id } });
  }

  private async getOrThrow(id: number) {
    const record = await this.prisma.moduleInvite.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`ModuleInvite ${id} not found`);
    }
    return record;
  }
}
