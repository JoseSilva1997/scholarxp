// Verifies QuestsPage renders grouped day cards and the load-more control from page-state data.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestTypeValues, type QuestView } from '@scholarxp/api-contracts';
import { describe, expect, it, vi } from 'vitest';
import QuestsPage from './QuestsPage';

const mocks = vi.hoisted(() => ({
  useQuestPageState: vi.fn(),
}));

vi.mock('../../hooks/page-state/useQuestPageState', () => ({
  useQuestPageState: mocks.useQuestPageState,
}));

describe('QuestsPage route', () => {
  it('renders day sections and load more button from page-state', () => {
    const loadMore = vi.fn();
    mocks.useQuestPageState.mockReturnValue({
      daySections: [
        { questDayUtc: '2026-02-17', dayLabel: 'Today', quests: [null, null, null] },
      ],
      isLoading: false,
      isLoadingMore: false,
      pageError: null,
      canLoadMore: true,
      loadMore,
    });

    render(<QuestsPage />);

    expect(screen.getByRole('heading', { name: 'Quest Journey' })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    const loadMoreButton = screen.getByRole('button', { name: 'View Older Quests' });
    fireEvent.click(loadMoreButton);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('keeps only one tooltip open across different quest history cards', async () => {
    const user = userEvent.setup();
    const firstQuest: QuestView = {
      id: 1,
      moduleId: 10,
      moduleUnitId: null,
      moduleTitle: 'Biology 101',
      moduleUnitTitle: null,
      type: QuestTypeValues.completeDailyPractice,
      expGranted: 25,
      isCompleted: false,
      description: 'First quest description',
      questDateUtc: '2026-02-17',
      generatedAt: '2026-02-17T00:00:00.000Z',
      completedAt: null,
    };
    const secondQuest: QuestView = {
      id: 2,
      moduleId: 11,
      moduleUnitId: null,
      moduleTitle: 'Chemistry 101',
      moduleUnitTitle: null,
      type: QuestTypeValues.completeDailyPractice,
      expGranted: 30,
      isCompleted: false,
      description: 'Second quest description',
      questDateUtc: '2026-02-16',
      generatedAt: '2026-02-16T00:00:00.000Z',
      completedAt: null,
    };

    mocks.useQuestPageState.mockReturnValue({
      daySections: [
        { questDayUtc: '2026-02-17', dayLabel: 'Today', quests: [firstQuest, null, null] },
        { questDayUtc: '2026-02-16', dayLabel: 'Feb 16, 2026', quests: [secondQuest, null, null] },
      ],
      isLoading: false,
      isLoadingMore: false,
      pageError: null,
      canLoadMore: false,
      loadMore: vi.fn(),
    });

    render(<QuestsPage />);

    await user.click(screen.getByRole('button', { name: 'Biology 101 quest details' }));
    expect(screen.getByText('First quest description')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chemistry 101 quest details' }));
    expect(screen.queryByText('First quest description')).not.toBeInTheDocument();
    expect(screen.getByText('Second quest description')).toBeInTheDocument();
  });
});
