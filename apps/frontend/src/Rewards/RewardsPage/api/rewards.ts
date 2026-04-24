// Cosmetic rewards API client — isolated from the daily XP track endpoint because the two domains share only a name.
import type {
  EquipCosmeticRequest,
  EquipCosmeticResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

export async function putEquippedCosmetic(
  payload: EquipCosmeticRequest,
): Promise<EquipCosmeticResponse> {
  return apiFetch<EquipCosmeticResponse>('/rewards/equipped', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
