// Public surface for the cosmetic rewards domain; keeping consumer imports short and stable across refactors.
export { CATALOG, getCatalogBySlot, getCatalogItem } from './catalog';
export type { CatalogItem, RewardRarity } from './catalog';
export {
  getLockedRewards,
  getNewlyUnlockedRewards,
  getNextUnlock,
  getSlotGroupedRewards,
  getUnlockedRewards,
} from './resolve';
export { ORDERED_SLOTS, SLOT_DISPLAY } from './slots';
export type { SlotDisplay } from './slots';
export { useCosmetics } from './useCosmetics';
