// Verifies rewards timeline state groups non-default catalog rewards into unlock milestones.
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRewardsTimelineState } from '@/Rewards/RewardsPage/page-state/useRewardsTimelineState';
import { useCosmetics } from '@/Rewards/cosmetics';

vi.mock('@/Rewards/cosmetics', () => ({
  CATALOG: [
    { id: 'light', name: 'Light', description: 'Default', slot: 'theme', unlocksAtLevel: 1 },
    { id: 'gold', name: 'Gold', description: 'Gold badge', slot: 'userBadge', unlocksAtLevel: 5 },
    { id: 'rare', name: 'Rare', description: 'Rare badge', slot: 'userBadge', unlocksAtLevel: 25 },
    { id: 'legend', name: 'Legend', description: 'Legend badge', slot: 'userBadge', unlocksAtLevel: 80 },
  ],
  useCosmetics: vi.fn(),
}));

describe('useRewardsTimelineState', () => {
  beforeEach(() => {
    vi.mocked(useCosmetics).mockReturnValue({ level: 25 } as never);
  });

  it('builds band headers, separators, alternating entries, and unlock flags', () => {
    const { result } = renderHook(() => useRewardsTimelineState());

    expect(result.current.level).toBe(25);
    expect(result.current.timelineItems).toContainEqual({ type: 'band-header', rarity: 'uncommon' });
    expect(result.current.timelineItems).toContainEqual({ type: 'separator', level: 25 });
    expect(result.current.timelineItems).toContainEqual({ type: 'band-header', rarity: 'rare' });
    expect(result.current.timelineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'entry', level: 5, side: 'right', isUnlocked: true }),
        expect.objectContaining({ type: 'entry', level: 25, side: 'left', isUnlocked: true }),
        expect.objectContaining({ type: 'entry', level: 80, side: 'right', isUnlocked: false }),
      ]),
    );
  });
});
