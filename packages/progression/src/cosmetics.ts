// Canonical cosmetic unlock table shared by backend validators and the frontend reward catalog.

// Slots enumerate every cosmetic surface the app can swap. Adding a slot is a coordinated code change
// on both sides — the UI, the catalog, and this table all need matching entries.
export const COSMETIC_SLOTS = [
  'theme',
  'proficiencyBadge',
  'moduleUnitBadge',
  'userBadge',
  'expBarColor',
  'background',
  'questBadgeSet',
  'userBadgeOverlay',
  'dailyPracticeButton',
  'answerFeedbackAnim',
] as const;

export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

export type EquippedCosmetics = Partial<Record<CosmeticSlot, string>>;

// Single source of truth for unlock thresholds. Backend guards equip requests against this so a tampered
// frontend cannot surface locked items without hitting a 403. Insertion order is intentional: it drives
// the order rewards appear in the catalog UI, so keep visual progression (default → rarer) aligned here.
export const COSMETIC_UNLOCKS: Record<CosmeticSlot, Record<string, number>> = {
  theme: {
    light: 1,
    dark: 1,
    aurora: 15,
    midnight: 40,
    ember: 65,
    celestial: 90,
  },
  proficiencyBadge: {
    plain: 1,
    ornate: 5,
    elite: 30,
    master: 55,
    legend: 80,
  },
  moduleUnitBadge: {
    standard: 1,
    polished: 10,
    prestige: 70,
  },
  userBadge: {
    standard: 1,
    silver: 25,
    gold: 50,
    diamond: 75,
  },
  expBarColor: {
    default: 1,
    red: 20,
    cyan: 20,
    purple: 20,
    orange: 20,
    rainbow: 60,
  },
  background: {
    default: 1,
    nebula: 45,
  },
  questBadgeSet: {
    standard: 1,
    mystic: 85,
  },
  userBadgeOverlay: {
    none: 1,
    apex: 100,
  },
  dailyPracticeButton: {
    default: 1,
    animatedBorder: 35,
  },
  answerFeedbackAnim: {
    default: 1,
    particles: 95,
  },
};

// Explicit per-slot defaults so the rendered baseline never depends on map iteration order —
// consumers get a stable identity for every slot on first load and on fallback paths.
export const COSMETIC_DEFAULTS: Record<CosmeticSlot, string> = {
  theme: 'light',
  proficiencyBadge: 'plain',
  moduleUnitBadge: 'standard',
  userBadge: 'standard',
  expBarColor: 'default',
  background: 'default',
  questBadgeSet: 'standard',
  userBadgeOverlay: 'none',
  dailyPracticeButton: 'default',
  answerFeedbackAnim: 'default',
};

function isKnownSlot(slot: string): slot is CosmeticSlot {
  return Object.prototype.hasOwnProperty.call(COSMETIC_UNLOCKS, slot);
}

// Accepts raw strings (not typed slots) so both sides can pass request payloads straight through —
// unknown slot or id fails closed so equip mutations cannot sneak past validation with typos.
export function isRewardUnlocked(
  slot: string,
  rewardId: string,
  level: number,
): boolean {
  if (!isKnownSlot(slot)) return false;
  const unlockLevel = COSMETIC_UNLOCKS[slot][rewardId];
  if (typeof unlockLevel !== 'number') return false;
  return level >= unlockLevel;
}

export function getDefaultRewardId(slot: CosmeticSlot): string {
  return COSMETIC_DEFAULTS[slot];
}

// Returns unlocked ids in catalog order so the rewards page can render them without an extra sort step.
export function getUnlockedRewardIds(slot: CosmeticSlot, level: number): string[] {
  const entries = COSMETIC_UNLOCKS[slot];
  return Object.keys(entries).filter((id) => level >= entries[id]);
}

// Normalizes a persisted JSON blob into a safely typed equipped map. Invalid keys, unknown ids, or ids
// whose unlock level now exceeds the user's level fall back to the per-slot default — the second case
// covers hypothetical XP regressions so the UI never tries to render an item the user can no longer earn.
export function sanitizeEquippedCosmetics(
  raw: unknown,
  level: number,
): Required<Record<CosmeticSlot, string>> {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const normalized = {} as Record<CosmeticSlot, string>;
  for (const slot of COSMETIC_SLOTS) {
    const candidate = source[slot];
    normalized[slot] =
      typeof candidate === 'string' && isRewardUnlocked(slot, candidate, level)
        ? candidate
        : getDefaultRewardId(slot);
  }

  return normalized;
}
