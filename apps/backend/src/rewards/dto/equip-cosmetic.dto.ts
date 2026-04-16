// Request DTO for the cosmetic equip endpoint; implements the shared contract so the client payload is type-locked.
import type { EquipCosmeticRequest } from '@scholarxp/api-contracts';
import { IsNotEmpty, IsString } from 'class-validator';

export class EquipCosmeticDto implements EquipCosmeticRequest {
  // Slot and rewardId are validated against the COSMETIC_UNLOCKS table in the service layer;
  // keeping format checks lightweight here avoids duplicating the catalog schema in two places.
  @IsString()
  @IsNotEmpty()
  slot: string;

  @IsString()
  @IsNotEmpty()
  rewardId: string;
}
