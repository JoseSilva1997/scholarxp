// UserModuleService handles roster records; it now supports module-scoped listing.
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserModuleDto } from './dto/create-user-module.dto';
import { UpdateUserModuleDto } from './dto/update-user-module.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserModuleService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserModuleDto: CreateUserModuleDto) {
    return this.prisma.userModule.create({ data: createUserModuleDto });
  }

  findAll(moduleId?: number) {
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

  private async getOrThrow(id: number) {
    const record = await this.prisma.userModule.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`UserModule ${id} not found`);
    }
    return record;
  }
}
