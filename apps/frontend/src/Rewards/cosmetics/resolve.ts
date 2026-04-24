// Frontend helpers that turn a user level into renderable catalog slices; keeps component code free of filter logic.
import type { CosmeticSlot } from '@scholarxp/progression';
import { CATALOG, getCatalogBySlot, type CatalogItem } from '@/Rewards/cosmetics/catalog';

export type SlotGroupedRewards = {
  slot: CosmeticSlot;
  unlocked: CatalogItem[];
  locked: CatalogItem[];
};

export function getUnlockedRewards(
  slot: CosmeticSlot,
  level: number,
): CatalogItem[] {
  return getCatalogBySlot(slot).filter((item) => item.unlocksAtLevel <= level);
}

export function getLockedRewards(
  slot: CosmeticSlot,
  level: number,
): CatalogItem[] {
  return getCatalogBySlot(slot).filter((item) => item.unlocksAtLevel > level);
}

export function getSlotGroupedRewards(
  slot: CosmeticSlot,
  level: number,
): SlotGroupedRewards {
  const items = getCatalogBySlot(slot);
  return {
    slot,
    unlocked: items.filter((item) => item.unlocksAtLevel <= level),
    locked: items.filter((item) => item.unlocksAtLevel > level),
  };
}

// Surfaces the next reward the user is about to unlock, regardless of slot. Used for level-up hints and
// the profile "next unlock" teaser — returns undefined when the user is at cap with nothing left to earn.
export function getNextUnlock(level: number): CatalogItem | undefined {
  const nextUnlocks = CATALOG.filter((item) => item.unlocksAtLevel > level).sort(
    (a, b) => a.unlocksAtLevel - b.unlocksAtLevel,
  );
  return nextUnlocks[0];
}

// Returns every reward unlocked by crossing from `fromLevel` to `toLevel`, inclusive of the target level.
// The level-up toast uses this to announce each new cosmetic in the same sequence the user earns them.
export function getNewlyUnlockedRewards(
  fromLevel: number,
  toLevel: number,
): CatalogItem[] {
  if (toLevel <= fromLevel) return [];
  return CATALOG.filter(
    (item) => item.unlocksAtLevel > fromLevel && item.unlocksAtLevel <= toLevel,
  ).sort((a, b) => a.unlocksAtLevel - b.unlocksAtLevel);
}
