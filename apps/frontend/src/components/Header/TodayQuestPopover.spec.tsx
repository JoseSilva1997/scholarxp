// Unit tests for TodayQuestPopover verify quest summary rendering, individual quest selection, and progress visuals.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TodayQuestPopover from './TodayQuestPopover';
import { renderWithProviders } from '../../test/utils';
import { QuestTypeValues, type QuestView } from '@scholarxp/api-contracts';

// Mock getQuestBadge to avoid path resolution issues in tests
vi.mock('../constants/quest-constants', () => ({
  getQuestBadge: vi.fn(() => '/mock-badge.png'),
}));

describe('TodayQuestPopover', () => {
const mockQuests: QuestView[] = [
    {
      id: 1,
      moduleTitle: 'Basics of React',
      description: 'Finish your first component',
      expGranted: 50,
      isCompleted: true,
      questDateUtc: '2024-05-20',
      type: QuestTypeValues.completeNewUnit,
      tier: 'daily',
      progressCurrent: 1,
      progressTarget: 1,
      moduleId: 1,
      moduleUnitId: 101,
      moduleUnitTitle: 'Components 101',
      generatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
    {
      id: 2,
      moduleTitle: 'Advanced State',
      description: 'Implement useMemo correctly',
      expGranted: 75,
      isCompleted: false,
      questDateUtc: '2024-05-20',
      type: QuestTypeValues.completeDailyPractice,
      tier: 'daily',
      progressCurrent: 0,
      progressTarget: 1,
      moduleId: 2,
      moduleUnitId: null,
      moduleUnitTitle: null,
      generatedAt: new Date().toISOString(),
      completedAt: null,
    },
];

const masterQuest: QuestView = {
  id: 99,
  moduleTitle: 'Master quest',
  description: 'Complete every daily quest available today to unlock the master quest reward.',
  expGranted: 300,
  rewardBreakdown: {
    baseExp: 250,
    streakBonusExp: 50,
    totalExp: 300,
  },
  isCompleted: false,
  questDateUtc: '2024-05-20',
  type: QuestTypeValues.masterDailyQuests,
  tier: 'master',
  progressCurrent: 1,
  progressTarget: 3,
  moduleId: null,
  moduleUnitId: null,
  moduleUnitTitle: null,
  generatedAt: new Date().toISOString(),
  completedAt: null,
};

  it('renders loading state correctly', () => {
    renderWithProviders(
      <TodayQuestPopover 
        id="test-popover" 
        quests={[]} 
        masterQuest={null}
        completed={0} 
        max={3} 
        hasDailyQuests={false}
        isLoading={true} 
      />
    );
    expect(screen.getByText('Loading quests...')).toBeInTheDocument();
  });

  it('renders empty state when no quests are provided', () => {
    renderWithProviders(
      <TodayQuestPopover 
        id="test-popover" 
        quests={[]} 
        masterQuest={null}
        completed={0} 
        max={0} 
        hasDailyQuests={false}
        isLoading={false} 
      />
    );
    expect(screen.getByText("You don't have any daily quests yet.")).toBeInTheDocument();
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    expect(
      screen.queryByText((content) =>
        content.includes("Completing all today's quests will grant"),
      ),
    ).not.toBeInTheDocument();
  });

  it('renders quest slots and identifies the active quest', () => {
    renderWithProviders(
      <TodayQuestPopover 
        id="test-popover" 
        quests={mockQuests} 
        masterQuest={masterQuest}
        completed={1} 
        max={2} 
        hasDailyQuests={true}
        isLoading={false} 
      />
    );

    // Verify progress text
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // Verify quest slots. Quest 2 should be active initially as it is the first incomplete one.
    const slots = screen.getAllByRole('button', { name: /View details for/ });
    expect(slots).toHaveLength(2);
    
    // Quest 2 (Incomplete) should be active by default
    expect(slots[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Advanced State')).toBeInTheDocument();
  });

  it('switches the active quest when a slot is clicked', async () => {
    renderWithProviders(
      <TodayQuestPopover 
        id="test-popover" 
        quests={mockQuests} 
        masterQuest={masterQuest}
        completed={1} 
        max={2} 
        hasDailyQuests={true}
        isLoading={false} 
      />
    );

    // Initially Quest 2 is active (first incomplete)
    expect(screen.getByText('Advanced State')).toBeInTheDocument();

    // Click on the first slot (Quest 1)
    const slots = screen.getAllByRole('button', { name: /View details for/ });
    fireEvent.click(slots[0]);

    // Now Quest 1 should be active. Use waitFor because AnimatePresence mode="wait"
    // might temporarily hide content during transitions.
    await waitFor(() => {
        expect(slots[0]).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('Basics of React')).toBeInTheDocument();
        expect(screen.getByText('Components 101')).toBeInTheDocument();
    });
  });

  it('renders correct completion status in the detail card', async () => {
    renderWithProviders(
      <TodayQuestPopover 
        id="test-popover" 
        quests={mockQuests} 
        masterQuest={masterQuest}
        completed={1} 
        max={2} 
        hasDailyQuests={true}
        isLoading={false} 
      />
    );

    // Initial state: Quest 2 (Incomplete) is active
    expect(screen.getByText('Quest in Progress')).toBeInTheDocument();

    // Select Quest 1 (Completed)
    const slots = screen.getAllByRole('button', { name: /View details for/ });
    fireEvent.click(slots[0]);

    // Check for success banner
    await waitFor(() => {
        expect(screen.getByText('Reward Received')).toBeInTheDocument();
    });
  });

  it('calls onNavigateToHistory when clicking the footer link', () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <TodayQuestPopover 
        id="test-popover" 
        quests={mockQuests} 
        masterQuest={masterQuest}
        completed={1} 
        max={2} 
        hasDailyQuests={true}
        isLoading={false} 
        onNavigateToHistory={onNavigate}
      />
    );

    const link = screen.getByText(/Check quest history/i);
    fireEvent.click(link);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(link.closest('a')).toHaveAttribute('href', '/main/quests');
  });

  it('keeps the empty state stable when no daily quests are available', () => {
    renderWithProviders(
      <TodayQuestPopover 
        id="test-popover" 
        quests={[]} 
        masterQuest={null}
        completed={0} 
        max={0} 
        hasDailyQuests={false}
        isLoading={false} 
      />
    );

    expect(screen.getByText("You don't have any daily quests yet.")).toBeInTheDocument();
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
  });

  it('shows the master quest chest state beside progress', () => {
    renderWithProviders(
      <TodayQuestPopover
        id="test-popover"
        quests={mockQuests}
        masterQuest={masterQuest}
        completed={1}
        max={2}
        hasDailyQuests={true}
        isLoading={false}
      />
    );

    expect(screen.getByLabelText('Master quest incomplete')).toBeInTheDocument();
  });

  it('shows the projected master quest reward hint under the progress bar', () => {
    renderWithProviders(
      <TodayQuestPopover
        id="test-popover"
        quests={mockQuests}
        masterQuest={masterQuest}
        completed={1}
        max={2}
        hasDailyQuests={true}
        isLoading={false}
      />
    );

    expect(screen.getByText(/Completing all quests today grants/)).toBeInTheDocument();
    expect(screen.getByText('+300')).toBeInTheDocument();
    expect(screen.getByText(/\+250 Base, \+50 Streak bonus/)).toBeInTheDocument();
  });

  it('prefers rewardBreakdown total exp over the master quest expGranted field', () => {
    renderWithProviders(
      <TodayQuestPopover
        id="test-popover"
        quests={mockQuests}
        masterQuest={{
          ...masterQuest,
          expGranted: 250,
          rewardBreakdown: {
            baseExp: 250,
            streakBonusExp: 50,
            totalExp: 300,
          },
        }}
        completed={1}
        max={2}
        hasDailyQuests={true}
        isLoading={false}
      />
    );

    expect(screen.getByText('+300')).toBeInTheDocument();
    expect(screen.queryByText('+250')).not.toBeInTheDocument();
    expect(screen.getByText(/\+250 Base, \+50 Streak bonus/)).toBeInTheDocument();
  });

  it('shows awarded copy when the master quest is complete', () => {
    renderWithProviders(
      <TodayQuestPopover
        id="test-popover"
        quests={mockQuests}
        masterQuest={{
          ...masterQuest,
          isCompleted: true,
          completedAt: new Date().toISOString(),
        }}
        completed={2}
        max={2}
        hasDailyQuests={true}
        isLoading={false}
      />
    );

    expect(screen.getByText('Awarded')).toBeInTheDocument();
    expect(screen.getByText('+300')).toBeInTheDocument();
  });
});
