// Exposes the cosmetic equip mutation; thin controller that defers all validation and blob logic to RewardsService.
import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { features } from '@scholarxp/permissions';
import type { EquipCosmeticResponse } from '@scholarxp/api-contracts';
import type { Request } from 'express';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthUser } from '../types/auth-user.type';
import { EquipCosmeticDto } from './dto/equip-cosmetic.dto';
import { RewardsService } from './rewards.service';

type RewardsRequest = Request & { user?: AuthUser };

@Controller('rewards')
@UseGuards(SessionAuthGuard, AuthorizationGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Put('equipped')
  @Authorize({ capability: features.rewards.equip, scope: 'global' })
  async equipCosmetic(
    @Req() request: RewardsRequest,
    @Body() body: EquipCosmeticDto,
  ): Promise<EquipCosmeticResponse> {
    const equippedCosmetics = await this.rewardsService.equipCosmetic({
      user: request.user as AuthUser,
      slot: body.slot,
      rewardId: body.rewardId,
    });
    return { equippedCosmetics };
  }
}
