// DailyLessonXpTrackChip tests cover its reward-track rendering independently from the surrounding header layout shell.
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import DailyLessonXpTrackChip from './DailyLessonXpTrackChip';

const queryMocks = vi.hoisted(() => ({
  useDailyLessonXpTrackQuery: vi.fn(),
}));

vi.mock('@/hooks/queries/useDailyXpTrackQueries', () => ({
  useDailyLessonXpTrackQuery: queryMocks.useDailyLessonXpTrackQuery,
}));

describe('DailyLessonXpTrackChip', () => {
  beforeEach(() => {
    queryMocks.useDailyLessonXpTrackQuery.mockReturnValue({
      data: {
        dayKeyUtc: '2026-03-15',
        completedLessonsToday: 1,
        nextRewardXp: 25,
        resetsAtUtc: '2026-03-16T00:00:00.000Z',
        steps: [
          { key: 'first_completion', rewardXp: 100, state: 'earned' },
          { key: 'second_completion', rewardXp: 25, state: 'active' },
          { key: 'practice', rewardXp: 0, state: 'upcoming' },
        ],
      },
    });
  });

  it('renders the reward track with earned and active step states', () => {
    renderWithProviders(<DailyLessonXpTrackChip userId={7} />);

    expect(screen.getByText('Lesson XP')).toBeInTheDocument();
    expect(
      screen.getByTestId('daily-lesson-xp-step-first_completion').className,
    ).toContain('stepEarned');
    expect(
      screen.getByTestId('daily-lesson-xp-step-second_completion').className,
    ).toContain('stepActive');
    expect(
      screen.getByTestId('daily-lesson-xp-step-practice').className,
    ).toContain('stepUpcoming');
  });

  it('falls back to the first active reward when data has not loaded yet', () => {
    queryMocks.useDailyLessonXpTrackQuery.mockReturnValue({ data: undefined });

    renderWithProviders(<DailyLessonXpTrackChip userId={7} />);

    expect(
      screen.getByTestId('daily-lesson-xp-step-first_completion').className,
    ).toContain('stepActive');
  });

  it('renders tooltip help copy for the reward pacing explanation', () => {
    renderWithProviders(<DailyLessonXpTrackChip userId={7} />);

    expect(screen.getByTestId('daily-lesson-xp-help')).toHaveAttribute(
      'aria-label',
      'Daily lesson XP help',
    );
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(tooltip).toHaveTextContent(
      'Your first newly completed lesson today grants +100 account XP.',
    );
    expect(tooltip).toHaveTextContent('The track resets at midnight UTC.');
  });

  it('switches to practice mode once extra lesson XP is exhausted', () => {
    queryMocks.useDailyLessonXpTrackQuery.mockReturnValue({
      data: {
        dayKeyUtc: '2026-03-15',
        completedLessonsToday: 4,
        nextRewardXp: 0,
        resetsAtUtc: '2026-03-16T00:00:00.000Z',
        steps: [
          { key: 'first_completion', rewardXp: 100, state: 'earned' },
          { key: 'second_completion', rewardXp: 25, state: 'earned' },
          { key: 'practice', rewardXp: 0, state: 'active' },
        ],
      },
    });

    renderWithProviders(<DailyLessonXpTrackChip userId={7} />);

    expect(
      screen.getByTestId('daily-lesson-xp-step-practice').className,
    ).toContain('stepActive');
  });
});
