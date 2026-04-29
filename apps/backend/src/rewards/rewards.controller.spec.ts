// Verifies RewardsController wraps cosmetic equip mutations in the shared response contract.
import { Test, type TestingModule } from '@nestjs/testing';
import { GlobalRole } from '@prisma/client';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

describe('RewardsController', () => {
  let controller: RewardsController;
  let rewardsService: { equipCosmetic: jest.Mock };

  beforeEach(async () => {
    rewardsService = {
      equipCosmetic: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RewardsController],
      providers: [{ provide: RewardsService, useValue: rewardsService }],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(RewardsController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('passes authenticated user and requested cosmetic to RewardsService', async () => {
    const user = { id: 8, globalRole: GlobalRole.student };
    const equippedCosmetics = { background: 'stars' };
    rewardsService.equipCosmetic.mockResolvedValue(equippedCosmetics);

    const result = await controller.equipCosmetic({ user } as never, {
      slot: 'background',
      rewardId: 'stars',
    });

    expect(rewardsService.equipCosmetic).toHaveBeenCalledWith({
      user,
      slot: 'background',
      rewardId: 'stars',
    });
    expect(result).toEqual({ equippedCosmetics });
  });
});
