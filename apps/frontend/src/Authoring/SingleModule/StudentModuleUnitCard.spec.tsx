// Verifies student lesson card behavior for lock state and collapsible detail display.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// useCompletionMedal depends on AuthContext; stub it to return the default asset
// so this spec can stay focused on card rendering/interaction logic.
vi.mock('@/Rewards/cosmetics/useCompletionMedal', () => ({
  useCompletionMedal: () => 'test-medal.png',
}));

import StudentModuleUnitCard from '@/Authoring/SingleModule/StudentModuleUnitCard';
import {
  MASTERY_TOTAL_EXP,
  MAXIMUM_FIRST_ATTEMPT_BONUS_EXP,
  MODULE_UNIT_BASELINE_EXP,
  STREAK_BONUS_EXP_PER_DELTA,
} from '@scholarxp/constants';

const baseUnit = {
  id: '11',
  title: 'Lesson A',
  status: 'live' as const,
  isCompleted: false,
  questionCount: 2,
  questionGroups: [
    {
      id: 'g1',
      title: 'Group 1',
      questions: [{ id: '101', title: 'Q1', lastAttemptResult: null }],
    },
  ],
};

describe('StudentModuleUnitCard', () => {
  const maximumStreakBonusExp = STREAK_BONUS_EXP_PER_DELTA * 3;
  // Base XP without streak — used when the unit has < 4 questions.
  const baseOnlyExp = MODULE_UNIT_BASELINE_EXP + MAXIMUM_FIRST_ATTEMPT_BONUS_EXP + MASTERY_TOTAL_EXP;
  // Full XP including streak — used when the unit has >= 4 questions.
  const fullExp = baseOnlyExp + maximumStreakBonusExp;

  it('shows question count for live lessons and toggles detail panel', () => {
    // baseUnit has questionCount: 2 (< 4) so streak bonus must not appear.
    render(<StudentModuleUnitCard unit={baseUnit} />);

    const xpSummary = screen.getByLabelText('Possible XP rewards');
    const baseRow = within(xpSummary).getByTitle('Base XP gained when a question is answered correctly.');
    const firstTryRow = within(xpSummary).getByTitle('Bonus XP for first-try correct answers');
    const masteryRow = within(xpSummary).getByTitle('XP earned through daily practice mastery');

    expect(screen.getByText('0/2 Questions')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(String(baseOnlyExp)))).toBeInTheDocument();
    expect(within(baseRow).getByText(String(MODULE_UNIT_BASELINE_EXP))).toBeInTheDocument();
    expect(within(firstTryRow).getByText(String(MAXIMUM_FIRST_ATTEMPT_BONUS_EXP))).toBeInTheDocument();
    expect(within(masteryRow).getByText(String(MASTERY_TOTAL_EXP))).toBeInTheDocument();
    expect(screen.queryByText('Streak')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand lesson details' }));
    expect(screen.getByRole('button', { name: 'Practice Q1' })).toBeInTheDocument();
  });

  it('hides streak bonus display for units with fewer than 4 questions', () => {
    // Units with questionCount 1, 2, 3 should never show streak rewards.
    for (const questionCount of [1, 2, 3]) {
      const { unmount } = render(
        <StudentModuleUnitCard unit={{ ...baseUnit, questionCount }} />,
      );
      expect(screen.queryByText('Streak')).not.toBeInTheDocument();
      expect(screen.getByText(new RegExp(String(baseOnlyExp)))).toBeInTheDocument();
      unmount();
    }
  });

  it('shows streak bonus display for units with 4 or more questions', () => {
    // 4 is the minimum unit size that participates in the streak mechanic.
    render(<StudentModuleUnitCard unit={{ ...baseUnit, questionCount: 4 }} />);

    const xpSummary = screen.getByLabelText('Possible XP rewards');
    // Target the full streak reward card so layout refactors inside the card do not break the assertion.
    const streakRow = within(xpSummary).getByTitle('Bonus XP for maintaining a streak');

    expect(streakRow).not.toBeNull();
    expect(within(streakRow as HTMLDivElement).getByText(String(maximumStreakBonusExp))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(String(fullExp)))).toBeInTheDocument();
  });

  it('disables practice button for locked lessons', () => {
    render(<StudentModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} />);

    expect(screen.getByRole('button', { name: 'Start Practice' })).toBeDisabled();
  });

  it('delegates to the parent when a specific practice-room question is clicked', () => {
    const onOpenPracticeRoom = vi.fn();
    render(
      <StudentModuleUnitCard
        unit={baseUnit}
        onOpenPracticeRoom={onOpenPracticeRoom}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand lesson details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice Q1' }));

    expect(onOpenPracticeRoom).toHaveBeenCalledWith('11', '101');
  });

  it('renders status symbols for correct and incorrect attempts', () => {
    render(
      <StudentModuleUnitCard
        unit={{
          ...baseUnit,
          questionGroups: [
            {
              id: 'g1',
              title: 'Group 1',
              questions: [
                { id: '101', title: 'Q1', lastAttemptResult: 'correct' as const },
                { id: '102', title: 'Q2', lastAttemptResult: 'incorrect' as const },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('1/2 Questions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand lesson details' }));

    expect(
      screen
        .getByTestId('question-status-101')
        .querySelector('svg')
        ?.getAttribute('class'),
    ).toContain('questionStatusCorrect');
    expect(
      screen
        .getByTestId('question-status-102')
        .querySelector('svg')
        ?.getAttribute('class'),
    ).toContain('questionStatusIncorrect');
  });

  it('hides expandable lesson details for locked lessons', () => {
    render(<StudentModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} />);

    expect(screen.queryByRole('button', { name: 'Expand lesson details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Practice Q1' })).not.toBeInTheDocument();
  });

  it('renders completion medal when the unit is marked completed', () => {
    render(<StudentModuleUnitCard unit={{ ...baseUnit, isCompleted: true }} />);

    expect(screen.getByAltText('Completion medal awarded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View answers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('delegates the primary button to the parent handler', () => {
    const onOpenPracticeRoom = vi.fn();
    render(
      <StudentModuleUnitCard
        unit={{ ...baseUnit, isCompleted: true }}
        onOpenPracticeRoom={onOpenPracticeRoom}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View answers' }));

    expect(onOpenPracticeRoom).toHaveBeenCalledWith('11');
  });

  it('delegates retry through the lesson-level retry handler only', () => {
    const onOpenPracticeRoom = vi.fn();
    const onRetryPracticeRoom = vi.fn();
    render(
      <StudentModuleUnitCard
        unit={{ ...baseUnit, isCompleted: true }}
        onOpenPracticeRoom={onOpenPracticeRoom}
        onRetryPracticeRoom={onRetryPracticeRoom}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetryPracticeRoom).toHaveBeenCalledWith('11');
    expect(onOpenPracticeRoom).not.toHaveBeenCalled();
  });
});
