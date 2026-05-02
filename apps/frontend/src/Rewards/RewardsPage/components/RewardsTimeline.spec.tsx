// Verifies rewards timeline renders bands, entries, reward icons, and measured fill fallback paths.
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineItem } from '@/Rewards/RewardsPage/page-state/useRewardsTimelineState';
import RewardsTimeline from '@/Rewards/RewardsPage/components/RewardsTimeline';

const items: TimelineItem[] = [
  { type: 'band-header', rarity: 'uncommon' },
  { type: 'entry', level: 5, side: 'right', isUnlocked: true, rewards: [
    { id: 'aurora', name: 'Aurora', description: 'Green', rarity: 'rare', slot: 'theme', unlocksAtLevel: 5 },
  ] as never },
  { type: 'separator', level: 25 },
  { type: 'band-header', rarity: 'rare' },
  { type: 'entry', level: 25, side: 'left', isUnlocked: false, rewards: [
    { id: 'badge', name: 'Badge', description: 'Badge', rarity: 'rare', slot: 'userBadge', unlocksAtLevel: 25 },
  ] as never },
];

describe('RewardsTimeline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders timeline bands and reward entries', () => {
    render(<RewardsTimeline level={12} timelineItems={items} />);

    expect(screen.getByText('Uncommon')).toBeInTheDocument();
    expect(screen.getByText('Rare')).toBeInTheDocument();
    expect(screen.getByText('Level 5')).toBeInTheDocument();
    expect(screen.getByText('Aurora')).toBeInTheDocument();
    expect(screen.getAllByText('Badge')).toHaveLength(2);
  });

  it('uses percentage fill when no level entries are present', () => {
    const { container } = render(<RewardsTimeline level={50} timelineItems={[{ type: 'band-header', rarity: 'epic' }]} />);

    expect(container.querySelector('[style="height: 50%;"]')).toBeInTheDocument();
  });
});
