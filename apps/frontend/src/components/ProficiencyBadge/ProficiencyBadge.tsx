// Dispatcher: resolves the student's equipped proficiency badge cosmetic to a concrete variant component.
import type { ComponentType } from 'react';
import { useCosmetics } from '@/rewards';
import type { BadgeVariantProps } from './types';
import PlainBadge from './variants/PlainBadge';
import OrnateBadge from './variants/OrnateBadge';
import EliteBadge from './variants/EliteBadge';
import MasterBadge from './variants/MasterBadge';
import LegendBadge from './variants/LegendBadge';

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

export function ProficiencyBadge({ forceVariant, ...props }: ProficiencyBadgeProps) {
  const { cosmetic } = useCosmetics();
  const variantId = forceVariant ?? cosmetic('proficiencyBadge');
  const Variant = VARIANT_MAP[variantId] ?? PlainBadge;
  return <Variant {...props} />;
}
