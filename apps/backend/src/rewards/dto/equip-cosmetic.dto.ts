// Request DTO for the cosmetic equip endpoint; implements the shared contract so the client payload is type-locked.
import type { EquipCosmeticRequest } from '@scholarxp/api-contracts';
import { IsNotEmpty, IsString } from 'class-validator';

export class EquipCosmeticDto implements EquipCosmeticRequest {
  // Slot and rewardId are validated against the cosmetic unlock catalog in the service layer;
  // keeping format checks lightweight here avoids duplicating the catalog schema in two places.

  // The avatar slot category to update (e.g. "hat", "border"). Must be a key recognised by the
  // shared @scholarxp/progression catalog — unknown keys are rejected as unlocked=false.
  @IsString()
  @IsNotEmpty()
  slot: string;

  // The specific cosmetic item within the slot to equip. Paired with `slot` to form the lookup
  // key used by isRewardUnlocked in the service.
  @IsString()
  @IsNotEmpty()
  rewardId: string;
}
