// MasterQuestStreakChip tests cover streak rendering and tooltip copy independently from the surrounding header shell.
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/shared/test/utils';
import MasterQuestStreakChip from '@/MainApp/Header/components/MasterQuestStreakChip';

const queryMocks = vi.hoisted(() => ({
  useMasterQuestStreakQuery: vi.fn(),
}));

vi.mock('@/Quests/queries/useQuestsQueries', () => ({
  useMasterQuestStreakQuery: queryMocks.useMasterQuestStreakQuery,
}));

describe('MasterQuestStreakChip', () => {
  beforeEach(() => {
    queryMocks.useMasterQuestStreakQuery.mockReturnValue({
      data: {
        currentStreak: 3,
        maxStreak: 5,
        bonusPercent: 30,
        bonusPercentPerStep: 10,
        lastCompletedQuestDateUtc: '2026-03-14',
      },
    });
  });

  it('renders five bead slots and lights beads up to the current streak', () => {
    renderWithProviders(<MasterQuestStreakChip userId={7} />);

    expect(screen.getByTestId('master-quest-streak-chip')).toHaveAttribute(
      'aria-label',
      'Master quest streak 3 out of 5.',
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('master-streak-bead-1').className).toContain(
      'beadActive',
    );
    expect(screen.getByTestId('master-streak-bead-3').className).toContain(
      'beadActive',
    );
    expect(screen.getByTestId('master-streak-bead-4').className).not.toContain(
      'beadActive',
    );
  });

  it('uses the fallback zeroed track when the query has not loaded yet', () => {
    queryMocks.useMasterQuestStreakQuery.mockReturnValue({ data: undefined });
    renderWithProviders(<MasterQuestStreakChip userId={7} />);

    expect(screen.getByTestId('master-quest-streak-chip')).toHaveAttribute(
      'aria-label',
      'Master quest streak 0 out of 5.',
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders help copy for the streak tooltip trigger', () => {
    renderWithProviders(<MasterQuestStreakChip userId={7} />);

    expect(screen.getByTestId('master-quest-streak-help')).toHaveAttribute(
      'aria-label',
      'Master quest streak help',
    );
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(tooltip).toHaveTextContent(
      'Complete the master quest on consecutive days to build your streak.',
    );
    expect(tooltip).toHaveTextContent(
      'Each increment adds 10% to the next master quest reward, up to 50%.',
    );
  });
});
