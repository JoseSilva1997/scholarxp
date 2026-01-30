// UserModuleService handles roster records; it now supports module-scoped listing.
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserModuleDto } from './dto/create-user-module.dto';
import { UpdateUserModuleDto } from './dto/update-user-module.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../types/auth-user.type';
import { assertHasAccess } from '../../helpers/permissions.helper';

@Injectable()
export class UserModuleService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserModuleDto: CreateUserModuleDto, user: AuthUser) {
    // Validate capabilities before hitting the database so we fail fast on forbidden requests.
    assertHasAccess('modules.settings', user, 'You do not have permission to manage module rosters.');
    return this.prisma.userModule.create({ data: createUserModuleDto });
  }

  findAll(moduleId: number | undefined, user: AuthUser) {
    assertHasAccess('modules.settings', user, 'You do not have permission to manage module rosters.');
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
    assertHasAccess('modules.settings', user, 'You do not have permission to manage module rosters.');
    await this.getOrThrow(id);
    return this.prisma.userModule.update({
      where: { id },
      data: updateUserModuleDto,
    });
  }

  async remove(id: number, user: AuthUser) {
    assertHasAccess('modules.settings', user, 'You do not have permission to manage module rosters.');
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
