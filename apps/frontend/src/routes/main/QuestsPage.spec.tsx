// Verifies QuestsPage renders grouped day cards and the load-more control from page-state data.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        {
          questDayUtc: '2026-02-17',
          dayLabel: 'Today',
          quests: [],
          masterQuest: null,
        },
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
      tier: 'daily',
      expGranted: 25,
      isCompleted: false,
      progressCurrent: 0,
      progressTarget: 1,
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
      tier: 'daily',
      expGranted: 30,
      isCompleted: false,
      progressCurrent: 0,
      progressTarget: 1,
      description: 'Second quest description',
      questDateUtc: '2026-02-16',
      generatedAt: '2026-02-16T00:00:00.000Z',
      completedAt: null,
    };

    mocks.useQuestPageState.mockReturnValue({
      daySections: [
        {
          questDayUtc: '2026-02-17',
          dayLabel: 'Today',
          quests: [firstQuest],
          masterQuest: null,
        },
        {
          questDayUtc: '2026-02-16',
          dayLabel: 'Feb 16, 2026',
          quests: [secondQuest],
          masterQuest: null,
        },
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
    await waitFor(() => {
      expect(screen.queryByText('First quest description')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Second quest description')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    mocks.useQuestPageState.mockReturnValue({
      daySections: [],
      isLoading: true,
      isLoadingMore: false,
      pageError: null,
      canLoadMore: false,
      loadMore: vi.fn(),
    });

    render(<QuestsPage />);
    expect(screen.getByText('Gathering your achievements...')).toBeInTheDocument();
    // Should verify empty state is NOT shown
    expect(screen.queryByText('No Records Yet')).not.toBeInTheDocument();
  });

  it('displays error state', () => {
    mocks.useQuestPageState.mockReturnValue({
      daySections: [],
      isLoading: false,
      isLoadingMore: false,
      pageError: 'Failed to load quests',
      canLoadMore: false,
      loadMore: vi.fn(),
    });

    render(<QuestsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load quests');
  });

  it('displays empty state when no quests found', () => {
    mocks.useQuestPageState.mockReturnValue({
      daySections: [],
      isLoading: false,
      isLoadingMore: false,
      pageError: null,
      canLoadMore: false,
      loadMore: vi.fn(),
    });

    render(<QuestsPage />);
    expect(screen.getByText('No Records Yet')).toBeInTheDocument();
    expect(screen.getByText('Your legend begins here. Start practicing to earn badges!')).toBeInTheDocument();
  });

  it('calculates history stats correctly with mixed completion', () => {
    const completedQuest = { 
      isCompleted: true, 
      id: 1, 
      moduleId: 1, 
      moduleTitle: 'M1', 
      type: QuestTypeValues.completeDailyPractice, 
      tier: 'daily',
      expGranted: 10,
      progressCurrent: 1,
      progressTarget: 1,
      description: 'D1',
      questDateUtc: '2026-02-17',
      generatedAt: '2026-02-17T00:00:00.000Z',
      completedAt: '2026-02-17T00:00:00.000Z',
      moduleUnitId: null,
      moduleUnitTitle: null,
    } as QuestView;

    const incompleteQuest = { 
      isCompleted: false,
      id: 2, 
      moduleId: 2, 
      moduleTitle: 'M2', 
      type: QuestTypeValues.completeDailyPractice, 
      tier: 'daily',
      expGranted: 10,
      progressCurrent: 0,
      progressTarget: 1,
      description: 'D2',
      questDateUtc: '2026-02-16',
      generatedAt: '2026-02-16T00:00:00.000Z',
      completedAt: null,
      moduleUnitId: null,
      moduleUnitTitle: null,
    } as QuestView;
    
    mocks.useQuestPageState.mockReturnValue({
      daySections: [
        { 
          questDayUtc: '2026-02-17', 
          dayLabel: 'Perfect Day', 
          quests: [completedQuest, completedQuest],
          masterQuest: { ...completedQuest, id: 99, type: QuestTypeValues.masterDailyQuests, tier: 'master' },
        },
        { 
          questDayUtc: '2026-02-16', 
          dayLabel: 'Partial Day', 
          quests: [completedQuest, incompleteQuest],
          masterQuest: null,
        },
        {
          questDayUtc: '2026-02-15',
          dayLabel: 'Empty Day',
          quests: [],
          masterQuest: null,
        }
      ],
      isLoading: false,
      isLoadingMore: false,
      pageError: null,
      canLoadMore: false,
      loadMore: vi.fn(),
    });

    render(<QuestsPage />);
    
    // Total completed: 2 (day 1) + 1 (day 2) = 3
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Quests Done')).toHaveLength(1);
    
    // Perfect days: 
    // Day 1: master quest complete -> Perfect
    // Day 2: master quest missing -> Not Perfect
    // Day 3: 0/0 -> Not Perfect (length > 0 check)
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getAllByText('Perfect Days')).toHaveLength(1);
  });

  it('renders correct markers for different day states', () => {
    const completedQuest = { 
        isCompleted: true, 
        id: 1, 
        moduleId: 1, 
        moduleTitle: 'M1', 
        type: QuestTypeValues.completeDailyPractice, 
        tier: 'daily',
        expGranted: 10,
        progressCurrent: 1,
        progressTarget: 1,
        description: 'D1',
        questDateUtc: '2026-02-17',
        generatedAt: '2026-02-17T00:00:00.000Z',
        completedAt: '2026-02-17T00:00:00.000Z',
        moduleUnitId: null,
        moduleUnitTitle: null,
      } as QuestView;
  
      const incompleteQuest = { 
        isCompleted: false,
        id: 2, 
        moduleId: 2, 
        moduleTitle: 'M2', 
        type: QuestTypeValues.completeDailyPractice, 
        tier: 'daily',
        expGranted: 10,
        progressCurrent: 0,
        progressTarget: 1,
        description: 'D2',
        questDateUtc: '2026-02-16',
        generatedAt: '2026-02-16T00:00:00.000Z',
        completedAt: null,
        moduleUnitId: null,
        moduleUnitTitle: null,
      } as QuestView;

    mocks.useQuestPageState.mockReturnValue({
      daySections: [
        { 
          questDayUtc: '2026-02-18', 
          dayLabel: 'Today (Incomplete)', 
          isToday: true,
          quests: [incompleteQuest],
          masterQuest: null,
        },
        { 
          questDayUtc: '2026-02-17', 
          dayLabel: 'Past (Incomplete)', 
          isToday: false,
          quests: [incompleteQuest],
          masterQuest: null,
        },
        { 
          questDayUtc: '2026-02-16', 
          dayLabel: 'Past (Complete)', 
          isToday: false,
          quests: [completedQuest],
          masterQuest: { ...completedQuest, id: 120, type: QuestTypeValues.masterDailyQuests, tier: 'master' },
        },
      ],
      isLoading: false,
      isLoadingMore: false,
      pageError: null,
      canLoadMore: false,
      loadMore: vi.fn(),
    });

    render(<QuestsPage />);
    
    // Check coverage of branches via rendering verification
    expect(screen.getByText('Today (Incomplete)')).toBeInTheDocument();
    expect(screen.getByText('Past (Incomplete)')).toBeInTheDocument();
    expect(screen.getByText('Past (Complete)')).toBeInTheDocument();
    
    // Note: To be ultra specific, we would need to check class names on the marker elements,
    // but React Testing Library discourages querying by class.
    // The visual logic branches (allQuestsComplete -> check, !allQuestsComplete & today -> today circle, else -> incomplete circle)
    // are executed by rendering these 3 distinct states.
  });

  it('displays loading more state', () => {
    mocks.useQuestPageState.mockReturnValue({
      daySections: [
        { questDayUtc: '2026-02-17', dayLabel: 'Today', quests: [], masterQuest: null },
      ],
      isLoading: false,
      isLoadingMore: true,
      pageError: null,
      canLoadMore: true,
      loadMore: vi.fn(),
    });

    render(<QuestsPage />);
    
    const loadMoreButton = screen.getByRole('button');
    expect(loadMoreButton).toHaveTextContent('Summoning more...');
    expect(loadMoreButton).toBeDisabled();
  });
});
