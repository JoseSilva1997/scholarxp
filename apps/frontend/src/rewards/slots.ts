// Display metadata for cosmetic slots — keeps user-facing copy and ordering out of the shared progression package,
// which needs to stay framework-agnostic for backend reuse.
import type { CosmeticSlot } from '@scholarxp/progression';

export type SlotDisplay = {
  slot: CosmeticSlot;
  title: string;
  description: string;
  // Affects both the Rewards page group order and the Profile cosmetics panel order.
  displayOrder: number;
};

// Display order is loosely "visual impact first" so the rewards page leads with theme/background choices
// before moving into badge variants and subtler effects.
export const SLOT_DISPLAY: Record<CosmeticSlot, SlotDisplay> = {
  theme: {
    slot: 'theme',
    title: 'Theme',
    description: 'Recolor the entire app. Light and dark ship with every account; more unlock as you level up.',
    displayOrder: 1,
  },
  background: {
    slot: 'background',
    title: 'Background',
    description: 'Swap the ambient page background for something more elaborate.',
    displayOrder: 2,
  },
  expBarColor: {
    slot: 'expBarColor',
    title: 'XP Bar Color',
    description: 'Personalise the colour of your XP progress bars.',
    displayOrder: 3,
  },
  proficiencyBadge: {
    slot: 'proficiencyBadge',
    title: 'Proficiency Badge',
    description: 'Change the badge that displays your proficiency level on module pages.',
    displayOrder: 4,
  },
  userBadge: {
    slot: 'userBadge',
    title: 'User Badge',
    description: 'Upgrade the frame around your avatar in the header.',
    displayOrder: 5,
  },
  userBadgeOverlay: {
    slot: 'userBadgeOverlay',
    title: 'User Badge Overlay',
    description: 'An extra ornament layered over your avatar frame — reserved for the level cap.',
    displayOrder: 6,
  },
  moduleUnitBadge: {
    slot: 'moduleUnitBadge',
    title: 'Unit Completion Badge',
    description: 'The badge you earn for completing a lesson unit.',
    displayOrder: 7,
  },
  answerFeedbackAnim: {
    slot: 'answerFeedbackAnim',
    title: 'Answer Feedback Flair',
    description: 'Extra particles layered over the correct/incorrect answer indicators in practice.',
    displayOrder: 8,
  },
};

// Stable ordering used by the Rewards page and cosmetics panel; consumers don't re-sort per render.
export const ORDERED_SLOTS: CosmeticSlot[] = Object.values(SLOT_DISPLAY)
  .sort((a, b) => a.displayOrder - b.displayOrder)
  .map((entry) => entry.slot);
