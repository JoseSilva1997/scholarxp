// Verifies student lesson card behavior for lock state and collapsible detail display.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StudentModuleUnitCard from './StudentModuleUnitCard';

const baseUnit = {
  id: '11',
  title: 'Lesson A',
  status: 'live' as const,
  questionCount: 2,
  questionGroups: [{ id: 'g1', title: 'Group 1', questions: [{ id: '101', title: 'Q1' }] }],
};

describe('StudentModuleUnitCard', () => {
  it('shows question count for live lessons and toggles detail panel', () => {
    render(<StudentModuleUnitCard unit={baseUnit} />);

    expect(screen.getByText('2 Questions')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand lesson details' }));
    expect(screen.getByText('Q1')).toBeInTheDocument();
  });

  it('disables practice button for locked lessons', () => {
    render(<StudentModuleUnitCard unit={{ ...baseUnit, status: 'locked' }} />);

    expect(screen.getByRole('button', { name: 'Start practice' })).toBeDisabled();
  });
});
