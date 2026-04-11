// Locks catalog integrity: every unlock entry has copy, defaults are at level 1, and resolve helpers respect unlock gates.
import { describe, expect, it } from 'vitest';
import {
  COSMETIC_DEFAULTS,
  COSMETIC_SLOTS,
  COSMETIC_UNLOCKS,
} from '@scholarxp/progression';
import {
  CATALOG,
  getCatalogBySlot,
  getCatalogItem,
} from './catalog';
import {
  getLockedRewards,
  getNewlyUnlockedRewards,
  getNextUnlock,
  getUnlockedRewards,
} from './resolve';
import { ORDERED_SLOTS, SLOT_DISPLAY } from './slots';

describe('catalog integrity', () => {
  it('has a catalog entry for every id in the shared unlock table', () => {
    for (const slot of COSMETIC_SLOTS) {
      const ids = Object.keys(COSMETIC_UNLOCKS[slot]);
      for (const id of ids) {
        const entry = getCatalogItem(slot, id);
        expect(entry, `${slot}/${id}`).toBeDefined();
        expect(entry?.name.length).toBeGreaterThan(0);
        expect(entry?.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('mirrors the shared unlock level for every entry', () => {
    for (const item of CATALOG) {
      expect(item.unlocksAtLevel).toBe(
        COSMETIC_UNLOCKS[item.slot][item.id],
      );
    }
  });

  it('every default id is present in the catalog at level 1', () => {
    for (const slot of COSMETIC_SLOTS) {
      const defaultId = COSMETIC_DEFAULTS[slot];
      const entry = getCatalogItem(slot, defaultId);
      expect(entry?.unlocksAtLevel).toBe(1);
    }
  });

  it('sorts per-slot results by unlock level ascending', () => {
    for (const slot of COSMETIC_SLOTS) {
      const entries = getCatalogBySlot(slot);
      for (let i = 1; i < entries.length; i += 1) {
        expect(entries[i].unlocksAtLevel).toBeGreaterThanOrEqual(
          entries[i - 1].unlocksAtLevel,
        );
      }
    }
  });
});

describe('slot display metadata', () => {
  it('covers every slot', () => {
    for (const slot of COSMETIC_SLOTS) {
      expect(SLOT_DISPLAY[slot]).toBeDefined();
      expect(SLOT_DISPLAY[slot].title.length).toBeGreaterThan(0);
    }
  });

  it('orders slots with no duplicates', () => {
    const orders = Object.values(SLOT_DISPLAY).map((entry) => entry.displayOrder);
    expect(new Set(orders).size).toBe(orders.length);
    expect(ORDERED_SLOTS.length).toBe(COSMETIC_SLOTS.length);
  });
});

describe('resolve helpers', () => {
  it('returns only items at or below the user level for unlocked queries', () => {
    const unlocked = getUnlockedRewards('theme', 20);
    const ids = unlocked.map((item) => item.id);
    expect(ids).toContain('light');
    expect(ids).toContain('dark');
    expect(ids).toContain('aurora');
    expect(ids).not.toContain('midnight');
  });

  it('returns only items above the user level for locked queries', () => {
    const locked = getLockedRewards('theme', 20);
    const ids = locked.map((item) => item.id);
    expect(ids).toContain('midnight');
    expect(ids).toContain('ember');
    expect(ids).not.toContain('light');
  });

  it('identifies the next unlock closest to the current level', () => {
    const next = getNextUnlock(4);
    expect(next?.slot).toBe('proficiencyBadge');
    expect(next?.unlocksAtLevel).toBe(5);
  });

  it('returns undefined at the level cap where nothing is left to earn', () => {
    expect(getNextUnlock(100)).toBeUndefined();
  });

  it('returns every reward unlocked between fromLevel and toLevel', () => {
    const newly = getNewlyUnlockedRewards(4, 20);
    const unlockLevels = newly.map((item) => item.unlocksAtLevel);
    expect(unlockLevels).toContain(5); // proficiencyBadge ornate
    expect(unlockLevels).toContain(10); // moduleUnitBadge polished
    expect(unlockLevels).toContain(15); // theme aurora
    expect(unlockLevels).toContain(20); // expBarColor reds/greens/purples/oranges
    // Sort order makes toasts announce rewards in earn order.
    for (let i = 1; i < unlockLevels.length; i += 1) {
      expect(unlockLevels[i]).toBeGreaterThanOrEqual(unlockLevels[i - 1]);
    }
  });

  it('handles non-progressing ranges as a no-op', () => {
    expect(getNewlyUnlockedRewards(20, 20)).toEqual([]);
    expect(getNewlyUnlockedRewards(30, 20)).toEqual([]);
  });
});
