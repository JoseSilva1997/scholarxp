// Orchestrates data and UI state for the Rewards browse page route.
import { useMemo, useState } from 'react';
import type { CosmeticSlot } from '@scholarxp/progression';
import {
  ORDERED_SLOTS,
  getSlotGroupedRewards,
  getNextUnlock,
  useCosmetics,
  type SlotDisplay,
  SLOT_DISPLAY,
} from '@/rewards';
import type { SlotGroupedRewards } from '@/rewards';

export type UseRewardsPageStateResult = {
  level: number;
  slotGroups: (SlotGroupedRewards & { display: SlotDisplay })[];
  nextUnlockName: string | null;
  nextUnlockLevel: number | null;
  equipped: Record<CosmeticSlot, string>;
  equipCosmetic: (slot: CosmeticSlot, rewardId: string) => Promise<void>;
  isEquipping: boolean;
  // Optional slot filter so the user can focus on one category at a time.
  activeSlotFilter: CosmeticSlot | null;
  setActiveSlotFilter: (slot: CosmeticSlot | null) => void;
};

export function useRewardsPageState(): UseRewardsPageStateResult {
  const { level, equipped, equipCosmetic, isEquipping } = useCosmetics();
  const [activeSlotFilter, setActiveSlotFilter] = useState<CosmeticSlot | null>(null);

  const slotGroups = useMemo(() => {
    const slots = activeSlotFilter ? [activeSlotFilter] : ORDERED_SLOTS;
    return slots.map((slot) => ({
      ...getSlotGroupedRewards(slot, level),
      display: SLOT_DISPLAY[slot],
    }));
  }, [level, activeSlotFilter]);

  const nextUnlock = useMemo(() => getNextUnlock(level), [level]);

  return {
    level,
    slotGroups,
    nextUnlockName: nextUnlock?.name ?? null,
    nextUnlockLevel: nextUnlock?.unlocksAtLevel ?? null,
    equipped,
    equipCosmetic,
    isEquipping,
    activeSlotFilter,
    setActiveSlotFilter,
  };
}
