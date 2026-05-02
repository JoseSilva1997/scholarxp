// Service for managing module invite links. Token values are hashed on creation and never stored
// in plaintext. Redemption atomically increments usage and creates the UserModule enrollment record.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EnrollmentSource,
  InviteType,
  Prisma,
  type Module,
  type ModuleInvite,
  type UserModule,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { CreateModuleInviteDto } from './dto/create-module-invite.dto';
import { UpdateModuleInviteDto } from './dto/update-module-invite.dto';
import { RedeemModuleInviteDto } from './dto/redeem-module-invite.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '@scholarxp/api-contracts';
import {
  FRONTEND_URL,
  MODULE_INVITE_DEFAULT_EXPIRY_HOURS,
  MODULE_INVITE_DEFAULT_MAX_USES,
} from '@scholarxp/constants';

@Injectable()
export class ModuleInviteService {
  constructor(private readonly prisma: PrismaService) {}

  // Generates a new invite link for the module. The raw token is returned exactly once;
  // subsequent lookups use the hash stored in the database.
  async create(
    moduleId: number,
    createModuleInviteDto: CreateModuleInviteDto,
    user: AuthUser,
  ) {
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

  async findAll(moduleId: number) {
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
  ) {
    await this.assertModuleAllowsInvites(moduleId);
    await this.getOrThrow(id, moduleId);

    // Prisma input type keeps us from accidentally writing fields we don't intend to update.
    const data: Prisma.ModuleInviteUpdateInput = {};
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

  async remove(moduleId: number, id: number) {
    await this.assertModuleAllowsInvites(moduleId);
    await this.getOrThrow(id, moduleId);
    const deleted = await this.prisma.moduleInvite.delete({ where: { id } });
    return this.sanitizeInvite(deleted);
  }

  // Validates the token and atomically enrolls the student. The operation is idempotent at the
  // unique-constraint level: a second redeem by the same user surfaces a 400 rather than silently creating a duplicate.
  async redeem(dto: RedeemModuleInviteDto, user: AuthUser) {
    // Use shared capability evaluator so backend and frontend stay aligned on who can redeem links.
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

  // Finds the invite by token hash and validates it is still active for module-based enrollment.
  private async findAndValidateInvite(tokenHash: string) {
    const invite = await this.prisma.moduleInvite.findFirst({
      where: { tokenHash },
      include: { module: true },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found or expired');
    }

    if (invite.module.archivedAt) {
      throw new NotFoundException('Invite not found or expired');
    }

    this.assertInviteIsActive(invite);
    return invite;
  }

  // Atomically increments invite usage and creates/updates enrollment to avoid race conditions.
  private async createEnrollmentWithIncrementedUsage(
    invite: Pick<ModuleInvite, 'id' | 'moduleId'>,
    user: AuthUser,
  ): Promise<UserModule> {
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
      let enrollment: UserModule;
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
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new BadRequestException(
            'You are already enrolled in this module',
          );
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

  private async getOrThrow(
    id: number,
    moduleId?: number,
  ): Promise<ModuleInvite> {
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
    if (module.archivedAt) {
      throw new NotFoundException(`Module ${moduleId} not found`);
    }
    return module;
  }

  // Validates revocation, expiry, and usage cap in one place so both the pre-transaction check
  // and the in-transaction re-validation call the same rules.
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

  // Strips the tokenHash from any outgoing invite object so the credential is never exposed via the API.
  private sanitizeInvite<T extends { tokenHash?: string }>(invite: T) {
    const { tokenHash: _tokenHash, ...rest } = invite;
    void _tokenHash; // Explicitly ignore the hash so we never leak it outside this service.
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
