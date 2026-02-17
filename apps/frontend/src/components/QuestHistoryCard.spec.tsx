// Validates that quest history cards keep a fixed three-slot layout and render only badge imagery.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuestHistoryCard from './QuestHistoryCard';

describe('QuestHistoryCard', () => {
  it('always renders exactly three slots', () => {
    render(<QuestHistoryCard />);

    expect(screen.getAllByTestId('quest-slot')).toHaveLength(3);
  });

  it('renders empty placeholders in all slots', () => {
    render(<QuestHistoryCard />);

    const slots = screen.getAllByTestId('quest-slot');
    expect(within(slots[0]).queryByRole('img')).not.toBeInTheDocument();
    expect(within(slots[1]).queryByRole('img')).not.toBeInTheDocument();
    expect(within(slots[2]).queryByRole('img')).not.toBeInTheDocument();
  });
});
