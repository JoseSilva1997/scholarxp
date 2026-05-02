// Cosmetic rewards API client — isolated from the daily XP track endpoint because the two domains share only a name.
import type {
  EquipCosmeticRequest,
  EquipCosmeticResponse,
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

// API gateway function for equipping a cosmetic; callers depend on typed contracts rather than route strings.
export async function putEquippedCosmetic(
  payload: EquipCosmeticRequest,
): Promise<EquipCosmeticResponse> {
  return apiFetch<EquipCosmeticResponse>('/rewards/equipped', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
