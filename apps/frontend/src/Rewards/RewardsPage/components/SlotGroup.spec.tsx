// Verifies slot groups split unlocked/locked cards and route equip actions with the slot id.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SlotGroup from '@/Rewards/RewardsPage/components/SlotGroup';

const unlocked = {
  id: 'aurora',
  name: 'Aurora',
  description: 'Green',
  rarity: 'rare',
  slot: 'theme',
  unlocksAtLevel: 10,
} as const;

const locked = {
  id: 'ember',
  name: 'Ember',
  description: 'Orange',
  rarity: 'epic',
  slot: 'theme',
  unlocksAtLevel: 50,
} as const;

describe('SlotGroup', () => {
  it('renders slot metadata and equips unlocked items', () => {
    const onEquip = vi.fn();
    render(
      <SlotGroup
        display={{ slot: 'theme', title: 'Themes', description: 'Choose palette' }}
        unlocked={[unlocked]}
        locked={[locked]}
        equippedId="light"
        onEquip={onEquip}
        isEquipping={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Themes' })).toBeInTheDocument();
    expect(screen.getByText('Ember')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Equip' }));

    expect(onEquip).toHaveBeenCalledWith('theme', 'aurora');
  });
});
