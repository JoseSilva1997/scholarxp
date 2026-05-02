// Frontend cosmetic catalog: layers display metadata on top of the shared unlock table so backend and UI stay aligned.
import {
  COSMETIC_UNLOCKS,
  COSMETIC_SLOTS,
  type CosmeticSlot,
} from '@scholarxp/progression';

export type RewardRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export type CatalogItem = {
  id: string;
  slot: CosmeticSlot;
  unlocksAtLevel: number;
  name: string;
  description: string;
  rarity: RewardRarity;
};

// Display labels are kept separate from the shared unlock table so backend code never depends on copy strings.
// Each entry must match an id that exists in COSMETIC_UNLOCKS — catalog.spec locks that invariant.
type CatalogEntryCopy = Omit<CatalogItem, 'slot' | 'unlocksAtLevel' | 'rarity'>;
type CatalogSlotCopy = Record<string, CatalogEntryCopy>;

const CATALOG_COPY: Record<CosmeticSlot, CatalogSlotCopy> = {
  theme: {
    light: {
      id: 'light',
      name: 'Light - Theme',
      description: 'The clean daytime palette every account starts with.',
    },
    dark: {
      id: 'dark',
      name: 'Dark - Theme',
      description: 'Easy on the eyes for late-night study sessions.',
    },
    aurora: {
      id: 'aurora',
      name: 'Aurora - Theme',
      description: 'Cool greens and teals inspired by the northern lights.',
    },
    midnight: {
      id: 'midnight',
      name: 'Midnight - Theme',
      description: 'Deep indigos for a calm, focused atmosphere.',
    },
    ember: {
      id: 'ember',
      name: 'Ember - Theme',
      description: 'Warm oranges and reds for a high-energy session.',
    },
    celestial: {
      id: 'celestial',
      name: 'Celestial - Theme',
      description: 'A starlit palette earned only by the most dedicated.',
    },
  },
  proficiencyBadge: {
    plain: {
      id: 'plain',
      name: 'Plain Number',
      description: 'A clean, understated number — your starting badge.',
    },
    ornate: {
      id: 'ornate',
      name: 'Ornate Hex - Proficiency level badge',
      description: 'A gold and green hexagonal crest.',
    },
    elite: {
      id: 'elite',
      name: 'Elite Crest - Proficiency level badge',
      description: 'A silver and blue shield-shaped badge.',
    },
    master: {
      id: 'master',
      name: "Master Crest - Proficiency level badge",
      description: 'A gold and purple ornate badge.',
    },
    legend: {
      id: 'legend',
      name: "Legend's Crest - Proficiency level badge",
      description: 'A legendary gold and orange badge with a radiant animated glow.',
    },
  },
  moduleUnitBadge: {
    standard: {
      id: 'standard',
      name: 'Standard Medal',
      description: 'The default badge awarded for completing a lesson.',
    },
    roseGold: {
      id: 'roseGold',
      name: 'Rose Gold Medal - Completion Medal',
      description: 'A Rose Gold Diamond-Textured Medal.',
    },
    antique: {
      id: 'antique',
      name: 'Antique Medal - Completion Medal',
      description: 'An Antique Gold Key-Patterned Medal.',
    },
  },
  userBadge: {
    standard: {
      id: 'standard',
      name: 'Standard Frame - User Badge',
      description: 'The default avatar frame.',
    },
    silver: {
      id: 'silver',
      name: 'Silver Frame - User Badge',
      description: 'A polished silver ring around your avatar.',
    },
    gold: {
      id: 'gold',
      name: 'Gold Frame - User Badge',
      description: 'A warm gold ring that marks seasoned students.',
    },
    diamond: {
      id: 'diamond',
      name: 'Diamond Frame - User Badge',
      description: 'A crystalline ring for the truly dedicated.',
    },
  },
  expBarColor: {
    default: {
      id: 'default',
      name: 'Default',
      description: 'The theme default XP fill.',
    },
    red: {
      id: 'red',
      name: 'Crimson - XP Bar Color',
      description: 'A bold red XP fill.',
    },
    cyan: {
      id: 'cyan',
      name: 'Aqua - XP Bar Color',
      description: 'A cool cyan XP fill.',
    },
    purple: {
      id: 'purple',
      name: 'Amethyst - XP Bar Color',
      description: 'A rich purple XP fill.',
    },
    orange: {
      id: 'orange',
      name: 'Sunset - XP Bar Color',
      description: 'A warm orange XP fill.',
    },
    rainbow: {
      id: 'rainbow',
      name: 'Rainbow - XP Bar Color',
      description: 'An animated rainbow gradient for students near the level cap.',
    },
  },
  background: {
    default: {
      id: 'default',
      name: 'Default',
      description: 'The standard app background.',
    },
    geometric: {
      id: 'geometric',
      name: 'Geometric - Background',
      description: 'A subtle repeating hexagonal grid layered over the background.',
    },
    nebula: {
      id: 'nebula',
      name: 'Nebula - Background',
      description: 'A deep-space nebula that shifts subtly as you scroll.',
    },
    scholar: {
      id: 'scholar',
      name: 'Scholar - Background',
      description: 'Scattered study icons — books, lightbulbs, and stars — as a wallpaper.',
    },
  },
  userBadgeOverlay: {
    none: {
      id: 'none',
      name: 'None',
      description: 'No overlay — the default.',
    },
    apex: {
      id: 'apex',
      name: 'Apex Overlay - User Badge Overlay',
      description: 'A shining overlay reserved for level 100.',
    },
  },
  answerFeedbackAnim: {
    default: {
      id: 'default',
      name: 'Default',
      description: 'The standard correct/incorrect feedback.',
    },
    particles: {
      id: 'particles',
      name: 'Particle Burst - Answer Feedback Animation',
      description: 'Extra particles layered over the default feedback animation.',
    },
  },
};

// Unlock level drives rarity tier: everyone gets baseline commons, uncommon stretches through the mid-20s,
// and epic/legendary are reserved for late-game to give long-term players something to chase.
function rarityForLevel(level: number): RewardRarity {
  if (level === 1) return 'common';
  if (level <= 25) return 'uncommon';
  if (level <= 50) return 'rare';
  if (level <= 75) return 'epic';
  return 'legendary';
}

// Builds the full catalog once at module load. Catalog copy lives alongside code, not in a JSON file,
// so new rewards can be added with a single edit and a type check catches missing translations.
function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [];
  for (const slot of COSMETIC_SLOTS) {
    const unlocks = COSMETIC_UNLOCKS[slot];
    const copy = CATALOG_COPY[slot];
    for (const [id, unlocksAtLevel] of Object.entries(unlocks)) {
      const entry = copy[id];
      if (!entry) {
        // Deliberate runtime assertion — surfaces missing copy during dev instead of shipping a blank card.
        throw new Error(
          `Missing catalog copy for cosmetic ${slot}/${id}. Update CATALOG_COPY in catalog.ts.`,
        );
      }
      items.push({
        id,
        slot,
        unlocksAtLevel,
        name: entry.name,
        description: entry.description,
        rarity: rarityForLevel(unlocksAtLevel),
      });
    }
  }
  return items;
}

export const CATALOG: readonly CatalogItem[] = Object.freeze(buildCatalog());

// Indexed lookup so per-slot queries don't rescan the full list on every render.
const CATALOG_BY_SLOT: Record<CosmeticSlot, CatalogItem[]> = COSMETIC_SLOTS.reduce(
  (acc, slot) => {
    acc[slot] = CATALOG.filter((item) => item.slot === slot).sort(
      (a, b) => a.unlocksAtLevel - b.unlocksAtLevel,
    );
    return acc;
  },
  {} as Record<CosmeticSlot, CatalogItem[]>,
);

// Returns catalog entries for a single slot in unlock order for page and profile rendering.
export function getCatalogBySlot(slot: CosmeticSlot): readonly CatalogItem[] {
  return CATALOG_BY_SLOT[slot];
}

// Looks up one catalog item by slot/id when other modules need copy for an equipped reward.
export function getCatalogItem(
  slot: CosmeticSlot,
  id: string,
): CatalogItem | undefined {
  return CATALOG_BY_SLOT[slot].find((item) => item.id === id);
}
