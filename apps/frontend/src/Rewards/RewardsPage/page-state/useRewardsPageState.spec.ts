// Verifies rewards page state groups cosmetics, filters slots, and exposes next unlock details.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRewardsPageState } from '@/Rewards/RewardsPage/page-state/useRewardsPageState';
import { useCosmetics } from '@/Rewards/cosmetics';

const cosmeticsMocks = vi.hoisted(() => ({
  useCosmetics: vi.fn(),
  getSlotGroupedRewards: vi.fn(),
  getNextUnlock: vi.fn(),
}));

vi.mock('@/Rewards/cosmetics', () => ({
  ORDERED_SLOTS: ['theme', 'background'],
  SLOT_DISPLAY: {
    theme: { slot: 'theme', title: 'Theme', description: 'Theme colors' },
    background: { slot: 'background', title: 'Background', description: 'Backdrop' },
  },
  useCosmetics: cosmeticsMocks.useCosmetics,
  getSlotGroupedRewards: cosmeticsMocks.getSlotGroupedRewards,
  getNextUnlock: cosmeticsMocks.getNextUnlock,
}));

describe('useRewardsPageState', () => {
  const equipCosmetic = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCosmetics).mockReturnValue({
      level: 12,
      equipped: { theme: 'aurora', background: 'plain' },
      equipCosmetic,
      isEquipping: false,
    } as never);
    cosmeticsMocks.getSlotGroupedRewards.mockImplementation((slot: string, level: number) => ({
      slot,
      level,
      unlocked: [],
      locked: [],
    }));
    cosmeticsMocks.getNextUnlock.mockReturnValue({ name: 'Celestial', unlocksAtLevel: 15 });
  });

  it('returns all slot groups and next unlock information by default', () => {
    const { result } = renderHook(() => useRewardsPageState());

    expect(result.current.level).toBe(12);
    expect(result.current.nextUnlockName).toBe('Celestial');
    expect(result.current.nextUnlockLevel).toBe(15);
    expect(result.current.slotGroups.map((group) => group.display.title)).toEqual([
      'Theme',
      'Background',
    ]);
  });

  it('filters to a single active slot and handles no upcoming unlock', () => {
    cosmeticsMocks.getNextUnlock.mockReturnValue(null);
    const { result } = renderHook(() => useRewardsPageState());

    act(() => result.current.setActiveSlotFilter('theme'));

    expect(result.current.activeSlotFilter).toBe('theme');
    expect(result.current.slotGroups).toHaveLength(1);
    expect(result.current.slotGroups[0].slot).toBe('theme');
    expect(result.current.nextUnlockName).toBeNull();
    expect(result.current.nextUnlockLevel).toBeNull();
  });
});
