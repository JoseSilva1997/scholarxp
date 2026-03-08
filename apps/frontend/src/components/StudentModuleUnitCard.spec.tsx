// Verifies student lesson card behavior for lock state and collapsible detail display.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentModuleUnitCard from './StudentModuleUnitCard';
import {
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
  const baseOnlyExp = MODULE_UNIT_BASELINE_EXP + MAXIMUM_FIRST_ATTEMPT_BONUS_EXP;
  // Full XP including streak — used when the unit has >= 4 questions.
  const fullExp = baseOnlyExp + maximumStreakBonusExp;

  beforeEach(() => {
    window.history.pushState({}, '', '/main/modules/9');
  });

  it('shows question count for live lessons and toggles detail panel', () => {
    // baseUnit has questionCount: 2 (< 4) so streak bonus must not appear.
    render(<StudentModuleUnitCard unit={baseUnit} />);

    expect(screen.getByText('0/2 Questions')).toBeInTheDocument();
    expect(screen.getByText(`Up to ${baseOnlyExp} XP`)).toBeInTheDocument();
    expect(screen.getByText(`+${MODULE_UNIT_BASELINE_EXP} base`)).toBeInTheDocument();
    expect(screen.getByText(`+${MAXIMUM_FIRST_ATTEMPT_BONUS_EXP} first try`)).toBeInTheDocument();
    expect(screen.queryByText(`+${maximumStreakBonusExp} streaks`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand lesson details' }));
    expect(screen.getByRole('button', { name: 'Practice Q1' })).toBeInTheDocument();
  });

  it('hides streak bonus display for units with fewer than 4 questions', () => {
    // Units with questionCount 1, 2, 3 should never show streak rewards.
    for (const questionCount of [1, 2, 3]) {
      const { unmount } = render(
        <StudentModuleUnitCard unit={{ ...baseUnit, questionCount }} />,
      );
      expect(screen.queryByText(`+${maximumStreakBonusExp} streaks`)).not.toBeInTheDocument();
      expect(screen.getByText(`Up to ${baseOnlyExp} XP`)).toBeInTheDocument();
      unmount();
    }
  });

  it('shows streak bonus display for units with 4 or more questions', () => {
    // 4 is the minimum unit size that participates in the streak mechanic.
    render(<StudentModuleUnitCard unit={{ ...baseUnit, questionCount: 4 }} />);

    expect(screen.getByText(`+${maximumStreakBonusExp} streaks`)).toBeInTheDocument();
    expect(screen.getByText(`Up to ${fullExp} XP`)).toBeInTheDocument();
  });

  it('disables practice button for locked lessons', () => {
    render(<StudentModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} />);

    expect(screen.getByRole('button', { name: 'Start Practice' })).toBeDisabled();
  });

  it('navigates to a specific practice-room question when question is clicked', () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });

    render(<StudentModuleUnitCard unit={baseUnit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Expand lesson details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice Q1' }));

    expect(assign).toHaveBeenCalledWith('/main/modules/9/11/practice-room?questionId=101');
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
  });
});
