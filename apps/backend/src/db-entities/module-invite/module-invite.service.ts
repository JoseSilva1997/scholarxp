import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InviteType, EnrollmentSource, type Module } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { CreateModuleInviteDto } from './dto/create-module-invite.dto';
import { UpdateModuleInviteDto } from './dto/update-module-invite.dto';
import { RedeemModuleInviteDto } from './dto/redeem-module-invite.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../types/auth-user.type';
import { assertHasAccess } from '../../helpers/permissions.helper';
import {
  FRONTEND_URL,
  MODULE_INVITE_DEFAULT_EXPIRY_HOURS,
  MODULE_INVITE_DEFAULT_MAX_USES,
} from '../../constants';

@Injectable()
export class ModuleInviteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    moduleId: number,
    createModuleInviteDto: CreateModuleInviteDto,
    user: AuthUser,
  ) {
    assertHasAccess(
      'modules.invitations',
      user,
      'You do not have permission to manage module invites',
    );
    await this.assertModuleAllowsInvites(moduleId);

    const expiryHours =
      createModuleInviteDto.expiresInHours ??
      MODULE_INVITE_DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    const maxUses =
      createModuleInviteDto.maxUses ?? MODULE_INVITE_DEFAULT_MAX_USES;

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    const invite = await this.prisma.moduleInvite.create({
      data: {
        moduleId,
        createdByUserId: user.id,
        type: InviteType.link,
        tokenHash,
        maxUses,
        expiresAt,
      },
    });

    // Return the shareable token and URL while keeping the hash private for storage.
    return {
      invite: this.sanitizeInvite(invite),
      token,
      url: `${FRONTEND_URL}/invite?token=${token}`,
    };
  }

  async findAll(moduleId: number, user: AuthUser) {
    assertHasAccess(
      'modules.invitations',
      user,
      'You do not have permission to view module invites',
    );
    await this.assertModuleAllowsInvites(moduleId);

    const invites = await this.prisma.moduleInvite.findMany({
      where: { moduleId },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map((invite) => this.sanitizeInvite(invite));
  }

  async findOne(id: number) {
    return this.getOrThrow(id);
  }

  async update(
    moduleId: number,
    id: number,
    updateModuleInviteDto: UpdateModuleInviteDto,
    user: AuthUser,
  ) {
    assertHasAccess(
      'modules.invitations',
      user,
      'You do not have permission to manage module invites',
    );
    await this.assertModuleAllowsInvites(moduleId);
    await this.getOrThrow(id, moduleId);

    const data: any = {};
    if (updateModuleInviteDto.maxUses !== undefined) {
      data.maxUses = updateModuleInviteDto.maxUses;
    }
    if (updateModuleInviteDto.expiresAt) {
      data.expiresAt = new Date(updateModuleInviteDto.expiresAt);
    }
    if (updateModuleInviteDto.revoke !== undefined) {
      data.revokedAt = updateModuleInviteDto.revoke ? new Date() : null;
    }

    const updated = await this.prisma.moduleInvite.update({
      where: { id },
      data,
    });
    return this.sanitizeInvite(updated);
  }

  async remove(moduleId: number, id: number, user: AuthUser) {
    assertHasAccess(
      'modules.invitations',
      user,
      'You do not have permission to manage module invites',
    );
    await this.assertModuleAllowsInvites(moduleId);
    await this.getOrThrow(id, moduleId);
    const deleted = await this.prisma.moduleInvite.delete({ where: { id } });
    return this.sanitizeInvite(deleted);
  }

  async redeem(dto: RedeemModuleInviteDto, user: AuthUser) {
    const tokenHash = this.hashToken(dto.token);
    const invite = await this.findAndValidateInvite(tokenHash);
    const enrollment = await this.createEnrollmentWithIncrementedUsage(
      invite,
      user,
    );

    return {
      moduleId: invite.moduleId,
      inviteId: invite.id,
      enrollmentId: enrollment.id,
    };
  }

  // Finds the invite by token hash and validates it's active and for a non-institution module.
  private async findAndValidateInvite(tokenHash: string) {
    const invite = await this.prisma.moduleInvite.findFirst({
      where: { tokenHash },
      include: { module: true },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found or expired');
    }

    if (invite.module.institutionId !== null) {
      throw new ForbiddenException(
        'Invites are only available for non-institution modules.',
      );
    }

    this.assertInviteIsActive(invite);
    return invite;
  }

  // Atomically increments invite usage and creates/updates enrollment to avoid race conditions.
  private async createEnrollmentWithIncrementedUsage(
    invite: { id: number; moduleId: number },
    user: AuthUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Reload inside the transaction to guard against stale counters.
      const freshInvite = await tx.moduleInvite.findUnique({
        where: { id: invite.id },
      });
      if (!freshInvite) {
        throw new NotFoundException('Invite not found or expired');
      }
      this.assertInviteIsActive(freshInvite);

      // Create enrollment first; if another redeem for the same user races, the unique constraint will fail and we avoid incrementing uses.
      let enrollment;
      try {
        enrollment = await tx.userModule.create({
          data: {
            moduleId: invite.moduleId,
            userId: user.id,
            roleInModule: 'student',
            userModuleLevel: 1,
            currentExp: 0,
            enrolledVia: EnrollmentSource.invite,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          throw new BadRequestException('You are already enrolled in this module');
        }
        throw err;
      }

      // Increment uses only after enrollment is created to avoid double-counting concurrent redeems by the same user.
      const now = new Date();
      const incremented = await tx.moduleInvite.updateMany({
        where: {
          id: invite.id,
          revokedAt: null,
          ...(freshInvite.expiresAt ? { expiresAt: { gt: now } } : {}),
          ...(freshInvite.maxUses !== null && freshInvite.maxUses !== undefined
            ? { uses: { lt: freshInvite.maxUses } }
            : {}),
        },
        data: { uses: { increment: 1 } },
      });

      if (incremented.count === 0) {
        throw new BadRequestException('Invite has reached its usage limit');
      }

      return enrollment;
    });
  }

  private async getOrThrow(id: number, moduleId?: number) {
    const record = await this.prisma.moduleInvite.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`ModuleInvite ${id} not found`);
    }
    if (moduleId && record.moduleId !== moduleId) {
      throw new ForbiddenException('Invite does not belong to this module');
    }
    return record;
  }

  private async assertModuleAllowsInvites(
    moduleId: number,
  ): Promise<Module | null> {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });
    if (!module) {
      throw new NotFoundException(`Module ${moduleId} not found`);
    }
    if (module.institutionId !== null) {
      throw new ForbiddenException(
        'Invites are only available for non-institution modules.',
      );
    }
    return module;
  }

  private assertInviteIsActive(invite: {
    expiresAt: Date | null;
    revokedAt: Date | null;
    maxUses: number | null;
    uses: number;
  }) {
    const now = new Date();
    if (invite.revokedAt) {
      throw new BadRequestException('Invite has been revoked');
    }
    if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Invite has expired');
    }
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      throw new BadRequestException('Invite has reached its usage limit');
    }
  }

  private sanitizeInvite<T extends { tokenHash?: string }>(invite: T) {
    const { tokenHash, ...rest } = invite;
    return rest;
  }

  private generateToken() {
    // 24 bytes -> 48 hex chars; plenty of entropy for shareable links.
    return randomBytes(24).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
