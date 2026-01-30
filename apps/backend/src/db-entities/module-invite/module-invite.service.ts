import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModuleInviteDto } from './dto/create-module-invite.dto';
import { UpdateModuleInviteDto } from './dto/update-module-invite.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../types/auth-user.type';
import { assertHasAccess } from '../../helpers/permissions.helper';

@Injectable()
export class ModuleInviteService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModuleInviteDto: CreateModuleInviteDto, user: AuthUser) {
    assertHasAccess('modules.invitations', user, 'You do not have permission to manage module invites');
    return this.prisma.moduleInvite.create({ data: createModuleInviteDto });
  }

  findAll(user: AuthUser) {
    assertHasAccess('modules.invitations', user, 'You do not have permission to view module invites');
    return this.prisma.moduleInvite.findMany();
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(
    id: number,
    updateModuleInviteDto: UpdateModuleInviteDto,
    user: AuthUser,
  ) {
    assertHasAccess('modules.invitations', user, 'You do not have permission to manage module invites');
    await this.getOrThrow(id);
    return this.prisma.moduleInvite.update({
      where: { id },
      data: updateModuleInviteDto,
    });
  }

  async remove(id: number, user: AuthUser) {
    assertHasAccess('modules.invitations', user, 'You do not have permission to manage module invites');
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
