// Verifies student lesson card behavior for lock state and collapsible detail display.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentModuleUnitCard from './StudentModuleUnitCard';

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
  beforeEach(() => {
    window.history.pushState({}, '', '/main/modules/9');
  });

  it('shows question count for live lessons and toggles detail panel', () => {
    render(<StudentModuleUnitCard unit={baseUnit} />);

    expect(screen.getByText('2 Questions')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand lesson details' }));
    expect(screen.getByRole('button', { name: 'Practice Q1' })).toBeInTheDocument();
  });

  it('disables practice button for locked lessons', () => {
    render(<StudentModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} />);

    expect(screen.getByRole('button', { name: 'Start practice' })).toBeDisabled();
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

  it('keeps question links disabled for locked lessons', () => {
    render(<StudentModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Expand lesson details' }));

    expect(screen.getByRole('button', { name: 'Practice Q1' })).toBeDisabled();
  });

  it('renders completion medal when the unit is marked completed', () => {
    render(<StudentModuleUnitCard unit={{ ...baseUnit, isCompleted: true }} />);

    expect(screen.getByAltText('Completion medal awarded')).toBeInTheDocument();
  });
});
