// Request/response shapes for the cosmetic equip endpoint; shared so Nest DTOs and the frontend client stay in lockstep.

// The response mirrors the sanitized blob the backend persists, so the client can drop it straight into auth cache
// without a second round trip. Keys are optional only because brand-new accounts may not have every slot set yet.
export interface EquipCosmeticRequest {
  slot: string;
  rewardId: string;
}

export interface EquipCosmeticResponse {
  equippedCosmetics: Record<string, string>;
}
