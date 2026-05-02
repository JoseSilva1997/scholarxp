// Verifies reward cards render locked, unlocked, equipped, and pending equip states.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RewardCard from '@/Rewards/RewardsPage/components/RewardCard';

const item = {
  id: 'aurora',
  name: 'Aurora Theme',
  description: 'Green accents',
  rarity: 'rare',
  slot: 'theme',
  unlocksAtLevel: 15,
} as const;

describe('RewardCard', () => {
  it('renders an unlocked equip button', () => {
    const onEquip = vi.fn();
    render(
      <RewardCard
        item={item}
        isUnlocked
        isEquipped={false}
        onEquip={onEquip}
        isEquipping={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Equip' }));

    expect(screen.getByText('Aurora Theme')).toBeInTheDocument();
    expect(onEquip).toHaveBeenCalledTimes(1);
  });

  it('renders equipped, locked, and equipping labels', () => {
    const { rerender } = render(
      <RewardCard item={item} isUnlocked isEquipped onEquip={vi.fn()} isEquipping={false} />,
    );
    expect(screen.getByText('Equipped')).toBeInTheDocument();

    rerender(
      <RewardCard item={item} isUnlocked={false} isEquipped={false} onEquip={vi.fn()} isEquipping={false} />,
    );
    expect(screen.getByText('Level 15')).toBeInTheDocument();

    rerender(
      <RewardCard item={item} isUnlocked isEquipped={false} onEquip={vi.fn()} isEquipping />,
    );
    expect(screen.getByRole('button', { name: 'Equipping...' })).toBeDisabled();
  });
});
