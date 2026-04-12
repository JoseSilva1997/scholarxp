// Locks cosmetic unlock thresholds so any product-spec drift produces a failing test instead of a silent UX bug.
import { describe, expect, it } from 'vitest';
import {
  COSMETIC_DEFAULTS,
  COSMETIC_SLOTS,
  COSMETIC_UNLOCKS,
  getDefaultRewardId,
  getUnlockedRewardIds,
  isRewardUnlocked,
  sanitizeEquippedCosmetics,
} from './cosmetics';
import { MAX_ACCOUNT_LEVEL } from './index';

describe('Cosmetic unlock table', () => {
  it('gives every slot at least one reward available at level 1', () => {
    for (const slot of COSMETIC_SLOTS) {
      const levelOneIds = Object.entries(COSMETIC_UNLOCKS[slot])
        .filter(([, lvl]) => lvl === 1)
        .map(([id]) => id);
      expect(levelOneIds.length, `slot ${slot}`).toBeGreaterThan(0);
    }
  });

  it('uses only unlock levels within the supported range', () => {
    for (const slot of COSMETIC_SLOTS) {
      for (const [id, lvl] of Object.entries(COSMETIC_UNLOCKS[slot])) {
        expect(lvl, `${slot}.${id}`).toBeGreaterThanOrEqual(1);
        expect(lvl, `${slot}.${id}`).toBeLessThanOrEqual(MAX_ACCOUNT_LEVEL);
      }
    }
  });

  it('declares a default for every slot that itself unlocks at level 1', () => {
    for (const slot of COSMETIC_SLOTS) {
      const defaultId = COSMETIC_DEFAULTS[slot];
      expect(COSMETIC_UNLOCKS[slot][defaultId], `${slot} default`).toBe(1);
    }
  });

  // Spec mirror: any change to the product rollout must update both the table and this assertion block,
  // which forces a deliberate review of the user-visible progression schedule.
  it('matches the product spec for every milestone unlock', () => {
    expect(COSMETIC_UNLOCKS.proficiencyBadge.ornate).toBe(5);
    expect(COSMETIC_UNLOCKS.moduleUnitBadge.polished).toBe(10);
    expect(COSMETIC_UNLOCKS.theme.aurora).toBe(15);
    expect(COSMETIC_UNLOCKS.expBarColor.red).toBe(20);
    expect(COSMETIC_UNLOCKS.expBarColor.cyan).toBe(20);
    expect(COSMETIC_UNLOCKS.expBarColor.purple).toBe(20);
    expect(COSMETIC_UNLOCKS.expBarColor.orange).toBe(20);
    expect(COSMETIC_UNLOCKS.userBadge.silver).toBe(25);
    expect(COSMETIC_UNLOCKS.proficiencyBadge.elite).toBe(30);
    expect(COSMETIC_UNLOCKS.dailyPracticeButton.animatedBorder).toBe(35);
    expect(COSMETIC_UNLOCKS.theme.midnight).toBe(40);
    expect(COSMETIC_UNLOCKS.background.nebula).toBe(45);
    expect(COSMETIC_UNLOCKS.userBadge.gold).toBe(50);
    expect(COSMETIC_UNLOCKS.proficiencyBadge.master).toBe(55);
    expect(COSMETIC_UNLOCKS.expBarColor.rainbow).toBe(60);
    expect(COSMETIC_UNLOCKS.theme.ember).toBe(65);
    expect(COSMETIC_UNLOCKS.moduleUnitBadge.prestige).toBe(70);
    expect(COSMETIC_UNLOCKS.userBadge.diamond).toBe(75);
    expect(COSMETIC_UNLOCKS.proficiencyBadge.legend).toBe(80);
    expect(COSMETIC_UNLOCKS.questBadgeSet.mystic).toBe(85);
    expect(COSMETIC_UNLOCKS.theme.celestial).toBe(90);
    expect(COSMETIC_UNLOCKS.answerFeedbackAnim.particles).toBe(95);
    expect(COSMETIC_UNLOCKS.userBadgeOverlay.apex).toBe(100);
  });
});

describe('isRewardUnlocked', () => {
  it('returns true at exactly the unlock level', () => {
    expect(isRewardUnlocked('proficiencyBadge', 'ornate', 5)).toBe(true);
  });

  it('returns true above the unlock level', () => {
    expect(isRewardUnlocked('proficiencyBadge', 'ornate', 6)).toBe(true);
  });

  it('returns false below the unlock level', () => {
    expect(isRewardUnlocked('proficiencyBadge', 'ornate', 4)).toBe(false);
  });

  // Fail-closed behavior protects the backend equip mutation from typos and tampered payloads.
  it('rejects unknown slots', () => {
    expect(isRewardUnlocked('notARealSlot', 'ornate', 100)).toBe(false);
  });

  it('rejects unknown ids within a known slot', () => {
    expect(isRewardUnlocked('theme', 'notARealTheme', 100)).toBe(false);
  });
});

describe('getDefaultRewardId', () => {
  it('returns the declared default for each slot', () => {
    expect(getDefaultRewardId('theme')).toBe('light');
    expect(getDefaultRewardId('proficiencyBadge')).toBe('plain');
    expect(getDefaultRewardId('userBadgeOverlay')).toBe('none');
  });
});

describe('getUnlockedRewardIds', () => {
  it('returns only level-1 items at level 1', () => {
    expect(getUnlockedRewardIds('theme', 1)).toEqual(['light', 'dark']);
    expect(getUnlockedRewardIds('expBarColor', 1)).toEqual(['default']);
  });

  it('includes the four exp bar colors at level 20 but not rainbow', () => {
    expect(getUnlockedRewardIds('expBarColor', 20)).toEqual([
      'default',
      'red',
      'cyan',
      'purple',
      'orange',
    ]);
  });

  it('includes rainbow once level 60 is reached', () => {
    expect(getUnlockedRewardIds('expBarColor', 60)).toContain('rainbow');
  });

  it('unlocks every entry at the level cap', () => {
    for (const slot of COSMETIC_SLOTS) {
      const unlocked = getUnlockedRewardIds(slot, MAX_ACCOUNT_LEVEL);
      const total = Object.keys(COSMETIC_UNLOCKS[slot]).length;
      expect(unlocked.length, `slot ${slot}`).toBe(total);
    }
  });
});

describe('sanitizeEquippedCosmetics', () => {
  it('fills missing slots with their default', () => {
    const out = sanitizeEquippedCosmetics({}, 100);
    for (const slot of COSMETIC_SLOTS) {
      expect(out[slot]).toBe(COSMETIC_DEFAULTS[slot]);
    }
  });

  it('keeps valid unlocked selections untouched', () => {
    const out = sanitizeEquippedCosmetics(
      { theme: 'midnight', expBarColor: 'orange' },
      60,
    );
    expect(out.theme).toBe('midnight');
    expect(out.expBarColor).toBe('orange');
  });

  it('falls back to default when an id is above the user level', () => {
    // Covers XP regression: the user once unlocked celestial but now sits below level 90.
    const out = sanitizeEquippedCosmetics({ theme: 'celestial' }, 60);
    expect(out.theme).toBe('light');
  });

  it('falls back to default for unknown ids', () => {
    const out = sanitizeEquippedCosmetics({ theme: 'bogus' }, 100);
    expect(out.theme).toBe('light');
  });

  it('tolerates null, arrays, and primitives without throwing', () => {
    const fromNull = sanitizeEquippedCosmetics(null, 100);
    const fromArray = sanitizeEquippedCosmetics([1, 2, 3], 100);
    const fromNumber = sanitizeEquippedCosmetics(42, 100);
    for (const result of [fromNull, fromArray, fromNumber]) {
      for (const slot of COSMETIC_SLOTS) {
        expect(result[slot]).toBe(COSMETIC_DEFAULTS[slot]);
      }
    }
  });
});
