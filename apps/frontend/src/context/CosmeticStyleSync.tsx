// Applies non-theme cosmetic selections as data-attributes on <html> so CSS can pick them up globally.
// Runs as a null-renderer inside AuthProvider, sibling to CosmeticThemeSync.
import { useEffect } from 'react';
import { useCosmetics } from '@/Rewards/cosmetics';

// Data-attributes written to <html> for CSS consumption. Each maps to one cosmetic slot.
const SYNCED_SLOTS = [
  { slot: 'expBarColor', attr: 'data-xp-color' },
  { slot: 'background', attr: 'data-bg' },
  { slot: 'userBadge', attr: 'data-user-badge' },
  { slot: 'userBadgeOverlay', attr: 'data-badge-overlay' },
] as const;

export function CosmeticStyleSync() {
  const { cosmetic } = useCosmetics();

  useEffect(() => {
    const root = document.documentElement;
    for (const { slot, attr } of SYNCED_SLOTS) {
      const value = cosmetic(slot as never);
      // Only set the attribute when the cosmetic differs from the default so the root element
      // stays clean for users who haven't unlocked anything yet.
      if (value && value !== 'default' && value !== 'standard' && value !== 'none') {
        root.setAttribute(attr, value);
      } else {
        root.removeAttribute(attr);
      }
    }
  }, [cosmetic]);

  return null;
}
