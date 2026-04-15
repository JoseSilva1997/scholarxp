// Locks the equip-cosmetic contract: enforces student-only access, level-gated unlock, and merge-preserving writes.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from '../test/test-helpers';
import type { AuthUser } from '../types/auth-user.type';
import { RewardsService } from './rewards.service';

describe('RewardsService', () => {
  let service: RewardsService;
  let prisma: PrismaMock;

  const studentUser: Pick<AuthUser, 'id' | 'globalRole'> = {
    id: 42,
    globalRole: 'student',
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [RewardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RewardsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rejects non-student users before touching the database', async () => {
    await expect(
      service.equipCosmetic({
        user: { id: 1, globalRole: 'teacher' },
        slot: 'theme',
        rewardId: 'light',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.avatar.findUnique).not.toHaveBeenCalled();
  });

  it('throws NotFound when the avatar row is missing', async () => {
    prisma.avatar.findUnique.mockResolvedValue(null);

    await expect(
      service.equipCosmetic({
        user: studentUser,
        slot: 'theme',
        rewardId: 'light',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects rewards whose unlock level is above the user level', async () => {
    // totalExp of 0 maps to level 1 — celestial unlocks at level 90.
    prisma.avatar.findUnique.mockResolvedValue({
      id: 7,
      totalExp: 0,
      equippedCosmetics: {},
    } as never);

    await expect(
      service.equipCosmetic({
        user: studentUser,
        slot: 'theme',
        rewardId: 'celestial',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.avatar.update).not.toHaveBeenCalled();
  });

  it('rejects unknown slot names without writing', async () => {
    prisma.avatar.findUnique.mockResolvedValue({
      id: 7,
      totalExp: 0,
      equippedCosmetics: {},
    } as never);

    await expect(
      service.equipCosmetic({
        user: studentUser,
        slot: 'notASlot',
        rewardId: 'light',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.avatar.update).not.toHaveBeenCalled();
  });

  it('merges new selection into existing blob so other slots survive', async () => {
    // totalExp that comfortably clears the silver unlock at level 25.
    const totalExpAtLevel30 = 15000;
    prisma.avatar.findUnique.mockResolvedValue({
      id: 7,
      totalExp: totalExpAtLevel30,
      equippedCosmetics: { theme: 'dark' },
    } as never);
    prisma.avatar.update.mockResolvedValue({} as never);

    const result = await service.equipCosmetic({
      user: studentUser,
      slot: 'userBadge',
      rewardId: 'silver',
    });

    expect(result.theme).toBe('dark');
    expect(result.userBadge).toBe('silver');
    // Untouched slots still fall back to defaults so the response is complete.
    expect(result.proficiencyBadge).toBe('plain');

    expect(prisma.avatar.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          equippedCosmetics: expect.objectContaining({
            theme: 'dark',
            userBadge: 'silver',
          }),
        }),
      }),
    );
  });

  it('drops stale selections during sanitize before merging', async () => {
    // Stored blob references a theme that is no longer unlocked because level regressed to 1.
    prisma.avatar.findUnique.mockResolvedValue({
      id: 7,
      totalExp: 0,
      equippedCosmetics: { theme: 'celestial' },
    } as never);
    prisma.avatar.update.mockResolvedValue({} as never);

    const result = await service.equipCosmetic({
      user: studentUser,
      slot: 'theme',
      rewardId: 'light',
    });

    // Sanitize falls theme back to the default before the merge commits 'light' in place.
    expect(result.theme).toBe('light');
  });
});
