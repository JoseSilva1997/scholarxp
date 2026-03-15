// TodayQuestChip tests cover its fetch-backed popover and acknowledgement behavior independently from Header layout concerns.
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import TodayQuestChip from './TodayQuestChip';

const queryMocks = vi.hoisted(() => ({
  useTodayQuestListQuery: vi.fn(),
  useMasterQuestStreakQuery: vi.fn(),
}));

vi.mock('@/hooks/queries/useQuestsQueries', () => ({
  useTodayQuestListQuery: queryMocks.useTodayQuestListQuery,
  useMasterQuestStreakQuery: queryMocks.useMasterQuestStreakQuery,
}));

describe('TodayQuestChip', () => {
  beforeEach(() => {
    sessionStorage.clear();
    queryMocks.useTodayQuestListQuery.mockReturnValue({
      data: { quests: [], masterQuest: null, completed: 0, max: 3 },
      isPending: false,
    });
    queryMocks.useMasterQuestStreakQuery.mockReturnValue({
      data: {
        currentStreak: 0,
        maxStreak: 5,
        bonusPercent: 0,
        bonusPercentPerStep: 10,
        lastCompletedQuestDateUtc: null,
      },
    });
  });

  it('opens the today quests popover when the chip is clicked', () => {
    queryMocks.useTodayQuestListQuery.mockReturnValue({
      data: {
        quests: [
          {
            id: 11,
            moduleId: 4,
            moduleUnitId: null,
            moduleTitle: 'Biology',
            moduleUnitTitle: null,
            type: 'complete_daily_practice',
            description: 'Complete your daily practice for Biology.',
            expGranted: 25,
            isCompleted: false,
            questDateUtc: '2026-02-19',
            generatedAt: '2026-02-19T00:00:00.000Z',
            completedAt: null,
          },
        ],
        masterQuest: null,
        completed: 0,
        max: 3,
      },
      isPending: false,
    });

    renderWithProviders(<TodayQuestChip userId={1} />);

    fireEvent.click(screen.getByRole('button', { name: /today's quests/i }));

    expect(screen.getByTestId('today-quest-popover')).toBeInTheDocument();
    expect(screen.getByText('Quests')).toBeInTheDocument();
    expect(screen.getByText('Biology')).toBeInTheDocument();
  });

  it('closes the today quests popover when clicking outside', () => {
    renderWithProviders(<TodayQuestChip userId={1} />);

    fireEvent.click(screen.getByRole('button', { name: /today's quests/i }));
    expect(screen.getByTestId('today-quest-popover')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('today-quest-popover')).not.toBeInTheDocument();
  });

  it('adds glow styling after quest progress exists', () => {
    queryMocks.useTodayQuestListQuery.mockReturnValue({
      data: { quests: [], masterQuest: null, completed: 1, max: 3 },
      isPending: false,
    });

    renderWithProviders(<TodayQuestChip userId={1} />);

    expect(screen.getByTestId('today-chip-wrapper').className).toContain(
      'todayChipWrapperGlow',
    );
  });

  it('dismisses the glow after acknowledging it, keeps it dismissed after refresh, and restores it when progress increases', () => {
    let todayQuestData = {
      quests: [],
      masterQuest: null,
      completed: 1,
      max: 3,
    };
    queryMocks.useTodayQuestListQuery.mockImplementation(() => ({
      data: todayQuestData,
      isPending: false,
    }));

    const { rerender } = renderWithProviders(<TodayQuestChip userId={1} />);

    expect(screen.getByTestId('today-chip-wrapper').className).toContain(
      'todayChipWrapperGlow',
    );

    fireEvent.click(screen.getByRole('button', { name: /today's quests/i }));

    expect(screen.getByTestId('today-chip-wrapper').className).not.toContain(
      'todayChipWrapperGlow',
    );

    rerender(<></>);
    rerender(<TodayQuestChip userId={1} />);

    expect(screen.getByTestId('today-chip-wrapper').className).not.toContain(
      'todayChipWrapperGlow',
    );

    todayQuestData = {
      ...todayQuestData,
      completed: 2,
    };

    rerender(<TodayQuestChip userId={1} />);

    expect(screen.getByTestId('today-chip-wrapper').className).toContain(
      'todayChipWrapperGlow',
    );
  });
});
