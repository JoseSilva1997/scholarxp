// Cosmetic facade hook: reads equipped selections from the auth cache, layers defaults, and exposes an equip mutation.
// This is the single hook UI components import — it hides the difference between "student with avatar" and
// "anonymous / tutor" so call sites never branch on role to pick a reward id.
import { useCallback, useMemo } from 'react';
import {
  COSMETIC_DEFAULTS,
  sanitizeEquippedCosmetics,
  type CosmeticSlot,
} from '@scholarxp/progression';
import { useAuth } from '@/context/AuthContext';
import { useEquipCosmeticMutation } from '@/shared/hooks/queries/useCosmeticsQueries';

type UseCosmeticsResult = {
  // Complete, sanitized map — every slot has a defined id, so components never branch on undefined.
  equipped: Record<CosmeticSlot, string>;
  // Returns the equipped id for a specific slot; convenience wrapper for single-slot consumers.
  cosmetic: (slot: CosmeticSlot) => string;
  // The user's current account level, forwarded from auth, so components don't wire up useAuth themselves.
  level: number;
  // Fires the equip mutation and resolves when the server confirms (optimistic cache update already applied).
  equipCosmetic: (slot: CosmeticSlot, rewardId: string) => Promise<void>;
  // Pending flag for the inflight mutation, so buttons can disable while the server round-trips.
  isEquipping: boolean;
};

// Facade hook pattern: presents reward state and equip behaviour through one stable frontend API.
export function useCosmetics(): UseCosmeticsResult {
  const { user } = useAuth();
  const mutation = useEquipCosmeticMutation();

  // Derive level from avatar progress when available; non-students and anonymous users get level 1 so they
  // still receive the full default set from sanitizeEquippedCosmetics without special-casing elsewhere.
  const level = user?.avatar?.level ?? 1;

  // Sanitize on every render so a stale blob from an older session cannot survive a level regression;
  // the helper is cheap (a single pass over the fixed slot list) so memoization is for identity stability only.
  const equipped = useMemo(
    () => sanitizeEquippedCosmetics(user?.avatar?.equippedCosmetics ?? null, level),
    [user?.avatar?.equippedCosmetics, level],
  );

  const cosmetic = useCallback(
    (slot: CosmeticSlot) => equipped[slot] ?? COSMETIC_DEFAULTS[slot],
    [equipped],
  );

  // The mutation hook owns cache updates and transport concerns; this facade exposes only the domain action.
  const equipCosmetic = useCallback(
    async (slot: CosmeticSlot, rewardId: string) => {
      await mutation.mutateAsync({ slot, rewardId });
    },
    [mutation],
  );

  return {
    equipped,
    cosmetic,
    level,
    equipCosmetic,
    isEquipping: mutation.isPending,
  };
}
