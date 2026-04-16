// View-only state for the rewards timeline — catalog items grouped by unlock level, no equip mutations.
import { useMemo } from 'react';
import { CATALOG, type CatalogItem } from '@/rewards';
import { useCosmetics } from '@/rewards';

export type BandRarity = 'uncommon' | 'rare' | 'epic' | 'legendary';

export type TimelineEntry = {
  type: 'entry';
  level: number;
  rewards: CatalogItem[];
  side: 'left' | 'right';
  isUnlocked: boolean;
};

export type TimelineSeparator = {
  type: 'separator';
  level: number;
};

export type TimelineBandHeader = {
  type: 'band-header';
  rarity: BandRarity;
};

export type TimelineItem = TimelineEntry | TimelineSeparator | TimelineBandHeader;

// Separators at 25/50/75 mark the start of a new rarity band; band header follows each separator.
// Uncommon covers the opening section (levels 5–20) since 1–4 are defaults everyone already owns.
const BAND_SEPARATOR_LEVELS = new Set([25, 50, 75]);
const BAND_RARITY: Record<number, BandRarity> = {
  25: 'rare',
  50: 'epic',
  75: 'legendary',
};

function buildTimeline(level: number): TimelineItem[] {
  // Group non-default items by unlock level — level-1 items ship with every account
  // and don't represent earned rewards, so they're excluded from the discovery view.
  const byLevel = new Map<number, CatalogItem[]>();
  for (const item of CATALOG) {
    if (item.unlocksAtLevel === 1) continue;
    const existing = byLevel.get(item.unlocksAtLevel) ?? [];
    existing.push(item);
    byLevel.set(item.unlocksAtLevel, existing);
  }

  const items: TimelineItem[] = [];
  // Uncommon chip at the very top of the timeline, before the first entry.
  items.push({ type: 'band-header', rarity: 'uncommon' });

  let sideIndex = 0;
  for (let milestone = 5; milestone <= 100; milestone += 5) {
    if (BAND_SEPARATOR_LEVELS.has(milestone)) {
      items.push({ type: 'separator', level: milestone });
      items.push({ type: 'band-header', rarity: BAND_RARITY[milestone] });
    }

    const rewards = byLevel.get(milestone);
    if (!rewards?.length) continue;

    items.push({
      type: 'entry',
      level: milestone,
      rewards,
      side: sideIndex % 2 === 0 ? 'right' : 'left',
      isUnlocked: level >= milestone,
    });
    sideIndex++;
  }

  return items;
}

export type UseRewardsTimelineStateResult = {
  level: number;
  timelineItems: TimelineItem[];
};

export function useRewardsTimelineState(): UseRewardsTimelineStateResult {
  const { level } = useCosmetics();
  const timelineItems = useMemo(() => buildTimeline(level), [level]);
  return { level, timelineItems };
}
