// Validates that quest history cards render daily quest badges plus the separate master quest chest affordance.
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
  tier: 'daily',
  expGranted: 15,
  isCompleted: false,
  progressCurrent: 0,
  progressTarget: 1,
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

const masterQuest: QuestView = {
  ...baseQuest,
  id: 99,
  moduleId: null,
  moduleUnitId: null,
  moduleTitle: 'Master quest',
  moduleUnitTitle: null,
  type: QuestTypeValues.masterDailyQuests,
  tier: 'master',
  expGranted: 250,
  progressCurrent: 3,
  progressTarget: 3,
  description: 'Complete all 3 daily quests to unlock the master quest reward.',
};

describe('QuestHistoryCard', () => {
  it('renders exactly the number of daily quests provided', () => {
    const { rerender } = render(<QuestHistoryCard quests={[baseQuest, newUnitQuest]} />);
    expect(screen.getAllByTestId('quest-slot')).toHaveLength(2);

    rerender(<QuestHistoryCard quests={[baseQuest]} />);
    expect(screen.getAllByTestId('quest-slot')).toHaveLength(1);
  });

  it('renders quest badges for populated slots and keeps the master chest separate', () => {
    render(<QuestHistoryCard quests={[baseQuest]} masterQuest={masterQuest} />);

    const slots = screen.getAllByTestId('quest-slot');
    expect(within(slots[0]).getByRole('img')).toBeInTheDocument();
    expect(screen.getByLabelText('Master quest incomplete')).toBeInTheDocument();
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

  it('renders a master quest chest at the end of the card', () => {
    render(
      <QuestHistoryCard
        quests={[baseQuest]}
        masterQuest={{ ...masterQuest, isCompleted: true, completedAt: '2026-02-17T00:15:00.000Z' }}
      />,
    );

    expect(screen.getByLabelText('Master quest completed')).toBeInTheDocument();
  });
});
