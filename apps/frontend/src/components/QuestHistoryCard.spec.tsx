// Validates that quest history cards keep a fixed three-slot layout and render only badge imagery.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuestTypeValues, type Quest } from '@scholarxp/api-contracts';
import QuestHistoryCard from './QuestHistoryCard';

const baseQuest: Quest = {
  id: 1,
  moduleId: 1,
  moduleTitle: 'Biology 101',
  type: QuestTypeValues.completeDailyPractice,
  expGranted: 15,
  isCompleted: false,
  questDateUtc: '2026-02-17',
  generatedAt: '2026-02-17T00:05:00.000Z',
  completedAt: null,
};

describe('QuestHistoryCard', () => {
  it('always renders exactly three slots', () => {
    render(<QuestHistoryCard quests={[null, null, null]} />);

    expect(screen.getAllByTestId('quest-slot')).toHaveLength(3);
  });

  it('renders quest badges for populated slots and placeholders for empty slots', () => {
    render(<QuestHistoryCard quests={[baseQuest, null, null]} />);

    const slots = screen.getAllByTestId('quest-slot');
    expect(within(slots[0]).getByRole('img')).toBeInTheDocument();
    expect(within(slots[1]).queryByRole('img')).not.toBeInTheDocument();
    expect(within(slots[2]).queryByRole('img')).not.toBeInTheDocument();
  });
});
