// Validates that quest history cards keep a fixed three-slot layout and render only badge imagery.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { QuestTypeValues, type QuestView } from '@scholarxp/api-contracts';
import QuestHistoryCard from './QuestHistoryCard';

const baseQuest: QuestView = {
  id: 1,
  moduleId: 1,
  moduleUnitId: null,
  moduleTitle: 'Biology 101',
  moduleUnitTitle: null,
  type: QuestTypeValues.completeDailyPractice,
  expGranted: 15,
  isCompleted: false,
  description: 'Complete the daily practice set for the Biology 101 module.',
  questDateUtc: '2026-02-17',
  generatedAt: '2026-02-17T00:05:00.000Z',
  completedAt: null,
};

const newUnitQuest: QuestView = {
  ...baseQuest,
  id: 2,
  moduleUnitId: 7,
  moduleUnitTitle: 'Cell Structure',
  type: QuestTypeValues.completeNewUnit,
  description:
    'Complete all questions from the Cell Structure lesson of your Biology 101 module.',
};

describe('QuestHistoryCard', () => {
  it('renders exactly the number of quests provided', () => {
    const { rerender } = render(<QuestHistoryCard quests={[null, null, null]} />);
    expect(screen.getAllByTestId('quest-slot')).toHaveLength(3);

    rerender(<QuestHistoryCard quests={[null, null]} />);
    expect(screen.getAllByTestId('quest-slot')).toHaveLength(2);

    rerender(<QuestHistoryCard quests={[null]} />);
    expect(screen.getAllByTestId('quest-slot')).toHaveLength(1);
  });

  it('renders quest badges for populated slots and placeholders for empty slots', () => {
    render(<QuestHistoryCard quests={[baseQuest, null]} />);

    const slots = screen.getAllByTestId('quest-slot');
    expect(within(slots[0]).getByRole('img')).toBeInTheDocument();
    expect(within(slots[1]).queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows tooltip details only after clicking a quest medal', async () => {
    const user = userEvent.setup();
    render(<QuestHistoryCard quests={[baseQuest]} />);

    expect(screen.queryByText('Module:')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Biology 101 quest details' }));
    expect(screen.getByText('Module:')).toBeInTheDocument();
    expect(screen.getByText('Info:')).toBeInTheDocument();
    expect(screen.getByText('Reward:')).toBeInTheDocument();
    expect(screen.queryByText('Lesson:')).not.toBeInTheDocument();
  });

  it('renders lesson in tooltip for complete_new_unit quests', async () => {
    const user = userEvent.setup();
    render(<QuestHistoryCard quests={[newUnitQuest]} />);

    await user.click(screen.getByRole('button', { name: 'Biology 101 quest details' }));
    expect(screen.getByText('Lesson:')).toBeInTheDocument();
    expect(screen.getByText('Cell Structure')).toBeInTheDocument();
  });

  it('closes tooltip when clicking outside', async () => {
    const user = userEvent.setup();
    render(<QuestHistoryCard quests={[baseQuest]} />);

    await user.click(screen.getByRole('button', { name: 'Biology 101 quest details' }));
    expect(screen.getByText('Module:')).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByText('Module:')).not.toBeInTheDocument();
    });
  });
});
