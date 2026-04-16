// Cosmetic equip mutation hook: posts the selection to the backend and merges the server-sanitized blob
// straight into the auth cache so every consumer (header badge, theme provider, profile panel) re-renders together.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AuthResponse,
  EquipCosmeticRequest,
  EquipCosmeticResponse,
} from '@scholarxp/api-contracts';
import { putEquippedCosmetic } from '@/api/rewards';
import { queryKeys } from '../query-keys';

export function useEquipCosmeticMutation() {
  const queryClient = useQueryClient();

  return useMutation<EquipCosmeticResponse, Error, EquipCosmeticRequest>({
    mutationKey: queryKeys.rewards.equipCosmetic,
    mutationFn: putEquippedCosmetic,
    onSuccess: (response) => {
      // Replace the equippedCosmetics slice of the cached auth response so every hook that reads
      // user.avatar.equippedCosmetics observes the server-authoritative value in the same render cycle.
      queryClient.setQueryData<AuthResponse | undefined>(
        queryKeys.auth.me,
        (previousValue) => {
          if (!previousValue?.user || !previousValue.user.avatar) {
            return previousValue;
          }
          return {
            ...previousValue,
            user: {
              ...previousValue.user,
              avatar: {
                ...previousValue.user.avatar,
                equippedCosmetics: response.equippedCosmetics,
              },
            },
          };
        },
      );
    },
  });
}
