// Verifies QuestsPage renders grouped day cards and the load-more control from page-state data.
import { fireEvent, render, screen } from '@testing-library/react';
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
      pageError: null,
      canLoadMore: true,
      loadMore,
    });

    render(<QuestsPage />);

    expect(screen.getByRole('heading', { name: 'Quest History' })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    const loadMoreButton = screen.getByRole('button', { name: 'Load more' });
    fireEvent.click(loadMoreButton);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});
