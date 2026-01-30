// UserModuleService handles roster records; it now supports module-scoped listing.
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserModuleDto } from './dto/create-user-module.dto';
import { UpdateUserModuleDto } from './dto/update-user-module.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../types/auth-user.type';
import { canAccess, type Role as PermissionRole } from '@scholarxp/permissions';

@Injectable()
export class UserModuleService {
  constructor(private readonly prisma: PrismaService) {}

  create(createUserModuleDto: CreateUserModuleDto, user: AuthUser) {
    this.assertHasAccess(user);
    return this.prisma.userModule.create({ data: createUserModuleDto });
  }

  findAll(moduleId: number | undefined, user: AuthUser) {
    this.assertHasAccess(user);
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
    this.assertHasAccess(user);
    await this.getOrThrow(id);
    return this.prisma.userModule.update({
      where: { id },
      data: updateUserModuleDto,
    });
  }

  async remove(id: number, user: AuthUser) {
    this.assertHasAccess(user);
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

  private assertHasAccess(user: AuthUser) {
    const allowed = canAccess('modules.settings', {
      role: user.globalRole as PermissionRole,
      hasInstitutionMembership: user.hasInstitutionMembership,
    });
    if (!allowed) {
      throw new ForbiddenException('User cannot manage roster');
    }
  }
}
