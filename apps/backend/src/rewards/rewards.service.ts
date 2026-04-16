// Owns cosmetic equip mutations: validates unlock level against the shared catalog and merges the Avatar JSON blob.
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  getProgressWithinLevel,
  isRewardUnlocked,
  sanitizeEquippedCosmetics,
  type EquippedCosmetics,
} from '@scholarxp/progression';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../types/auth-user.type';

type EquipArgs = {
  user: Pick<AuthUser, 'id' | 'globalRole'>;
  slot: string;
  rewardId: string;
};

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async equipCosmetic(args: EquipArgs): Promise<Record<string, string>> {
    // Cosmetics are attached to the Avatar row which only exists for students; reject earlier roles explicitly
    // so the client sees a clear Forbidden instead of a cryptic "avatar not found" 404.
    if (args.user.globalRole !== 'student') {
      throw new ForbiddenException('Only students can equip cosmetics.');
    }

    const avatar = await this.prisma.avatar.findUnique({
      where: { userId: args.user.id },
      select: { id: true, totalExp: true, equippedCosmetics: true },
    });

    if (!avatar) {
      throw new NotFoundException('Avatar not found.');
    }

    const { level } = getProgressWithinLevel(avatar.totalExp);

    // Fails closed for unknown slots, unknown ids, or levels below the unlock threshold — the shared
    // validator in @scholarxp/progression is the single source of truth so the frontend catalog
    // cannot grant access to something the backend would reject.
    if (!isRewardUnlocked(args.slot, args.rewardId, level)) {
      throw new ForbiddenException('Reward is not available for your level.');
    }

    // Merge into the existing blob rather than replacing it so other slot selections survive;
    // sanitizeEquippedCosmetics runs before the merge to drop any stale entries persisted pre-validation.
    const currentBlob = sanitizeEquippedCosmetics(
      avatar.equippedCosmetics,
      level,
    );
    const nextBlob: EquippedCosmetics = {
      ...currentBlob,
      [args.slot]: args.rewardId,
    };

    await this.prisma.avatar.update({
      where: { id: avatar.id },
      data: { equippedCosmetics: nextBlob },
    });

    return nextBlob as Record<string, string>;
  }
}
