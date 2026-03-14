// MasterQuestStreakChip tests cover streak rendering and collapse behavior independently from the surrounding header shell.
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import MasterQuestStreakChip from './MasterQuestStreakChip';

const queryMocks = vi.hoisted(() => ({
  useMasterQuestStreakQuery: vi.fn(),
}));

vi.mock('@/hooks/queries/useQuestsQueries', () => ({
  useMasterQuestStreakQuery: queryMocks.useMasterQuestStreakQuery,
}));

describe('MasterQuestStreakChip', () => {
  beforeEach(() => {
    localStorage.clear();
    queryMocks.useMasterQuestStreakQuery.mockReturnValue({
      data: {
        currentStreak: 3,
        maxStreak: 5,
        bonusPercent: 30,
        bonusPercentPerStep: 10,
        lastCompletedQuestDateUtc: '2026-03-14',
      },
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it('renders five bead slots and lights beads up to the current streak when expanded', () => {
    renderWithProviders(<MasterQuestStreakChip userId={7} />);

    expect(screen.getByTestId('master-quest-streak-chip')).toHaveAttribute(
      'aria-expanded',
      'true',
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

  it('collapses into a compact chip and persists the preference', () => {
    renderWithProviders(<MasterQuestStreakChip userId={7} />);

    fireEvent.click(screen.getByTestId('master-quest-streak-chip'));

    expect(screen.getByTestId('master-quest-streak-chip')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByTestId('master-streak-bead-1')).not.toBeInTheDocument();
    expect(localStorage.getItem('master-quest-streak-chip-collapsed:7')).toBe(
      'true',
    );
  });

  it('defaults to collapsed on mobile-sized viewports when no preference is stored', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    renderWithProviders(<MasterQuestStreakChip userId={7} />);

    expect(screen.getByTestId('master-quest-streak-chip')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByTestId('master-streak-bead-1')).not.toBeInTheDocument();
  });
});
