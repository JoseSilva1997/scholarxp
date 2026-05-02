// Public surface for the cosmetic rewards domain; keeping consumer imports short and stable across refactors.
export { CATALOG, getCatalogBySlot, getCatalogItem } from '@/Rewards/cosmetics/catalog';
export type { CatalogItem, RewardRarity } from '@/Rewards/cosmetics/catalog';
export {
  getLockedRewards,
  getNewlyUnlockedRewards,
  getNextUnlock,
  getSlotGroupedRewards,
  getUnlockedRewards,
} from '@/Rewards/cosmetics/resolve';
export type { SlotGroupedRewards } from '@/Rewards/cosmetics/resolve';
export { ORDERED_SLOTS, SLOT_DISPLAY } from '@/Rewards/cosmetics/slots';
export type { SlotDisplay } from '@/Rewards/cosmetics/slots';
export { useCosmetics } from '@/Rewards/cosmetics/useCosmetics';
export { useCompletionMedal } from '@/Rewards/cosmetics/useCompletionMedal';
