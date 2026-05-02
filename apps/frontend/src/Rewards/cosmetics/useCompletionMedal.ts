// Resolves the equipped module-unit badge cosmetic to a medal image asset + a scale correction.
// The variant PNGs have transparent padding around the medal so they render smaller at the same CSS
// dimensions as the default. The scale factor compensates without changing the shared CSS rules.
import defaultMedal from '@/assets/module-unit/module-unit-completed-medal.png';
import roseGoldMedal from '@/assets/module-unit/module-unit-completed-medal-rose_gold.png';
import antiqueMedal from '@/assets/module-unit/module-unit-completed-medal-antique.png';
import { useCosmetics } from '@/Rewards/cosmetics/useCosmetics';

type MedalVariant = { src: string; scale: number };

const MEDAL_VARIANTS: Record<string, MedalVariant> = {
  standard: { src: defaultMedal, scale: 1 },
  roseGold: { src: roseGoldMedal, scale: 1.4 },
  antique:  { src: antiqueMedal, scale: 1.7 },
};

const DEFAULT_VARIANT: MedalVariant = MEDAL_VARIANTS.standard;

// Resolves the currently equipped lesson-completion medal for consumers that render the shared medal asset.
export function useCompletionMedal(): MedalVariant {
  const { cosmetic } = useCosmetics();
  const id = cosmetic('moduleUnitBadge');
  return MEDAL_VARIANTS[id] ?? DEFAULT_VARIANT;
}
