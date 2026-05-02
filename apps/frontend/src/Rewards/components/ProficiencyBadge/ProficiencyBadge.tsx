// Dispatcher: resolves the student's equipped proficiency badge cosmetic to a concrete variant component.
import type { ComponentType } from 'react';
import { useCosmetics } from '@/Rewards/cosmetics';
import type { BadgeVariantProps } from '@/Rewards/components/ProficiencyBadge/types';
import PlainBadge from '@/Rewards/components/ProficiencyBadge/variants/PlainBadge';
import OrnateBadge from '@/Rewards/components/ProficiencyBadge/variants/OrnateBadge';
import EliteBadge from '@/Rewards/components/ProficiencyBadge/variants/EliteBadge';
import MasterBadge from '@/Rewards/components/ProficiencyBadge/variants/MasterBadge';
import LegendBadge from '@/Rewards/components/ProficiencyBadge/variants/LegendBadge';

const VARIANT_MAP: Record<string, ComponentType<BadgeVariantProps>> = {
  plain: PlainBadge,
  ornate: OrnateBadge,
  elite: EliteBadge,
  master: MasterBadge,
  legend: LegendBadge,
};

type ProficiencyBadgeProps = BadgeVariantProps & {
  // When set, forces a specific variant regardless of the equipped cosmetic.
  // Used by the tutor roster where students' cosmetics should not leak into a management view.
  forceVariant?: string;
};

// Strategy pattern: selects one badge implementation from the equipped reward id while keeping callers variant-agnostic.
export function ProficiencyBadge({ forceVariant, ...props }: ProficiencyBadgeProps) {
  const { cosmetic } = useCosmetics();
  const variantId = forceVariant ?? cosmetic('proficiencyBadge');
  const Variant = VARIANT_MAP[variantId] ?? PlainBadge;
  return <Variant {...props} />;
}
