// Verifies roster summary cards show the lesson coverage threshold copy tutors rely on for quick module health checks.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RosterSummaryResponse } from '@scholarxp/api-contracts';
import RosterSummaryCards from './RosterSummaryCards';

const summary: RosterSummaryResponse = {
  moduleId: 1,
  moduleTitle: 'Algebra',
  studentsEnrolled: 4,
  activeLast7Days: 3,
  atRiskCount: 1,
  lessonCoverage: {
    totalLiveLessons: 6,
    lessonsStartedByAtLeastOneStudent: 5,
    lessonsCompletedByAtLeastHalfOfStudents: 4,
  },
};

describe('RosterSummaryCards', () => {
  it('shows lesson coverage as lessons completed by at least half of students', () => {
    render(
      <RosterSummaryCards
        summary={summary}
        isLoading={false}
        onStudentsEnrolledClick={vi.fn()}
        onActiveLast7DaysClick={vi.fn()}
        onAtRiskClick={vi.fn()}
        onLessonCoverageClick={vi.fn()}
      />,
    );

    expect(screen.getByText('4/6')).toBeInTheDocument();
    expect(
      screen.getByText('completed by at least 50% of students'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Lesson coverage 4/6, completed by at least 50% of students. View lesson details.',
      }),
    ).toBeInTheDocument();
  });

  it('routes lesson coverage clicks through the lesson detail shortcut', () => {
    const onLessonCoverageClick = vi.fn();

    render(
      <RosterSummaryCards
        summary={summary}
        isLoading={false}
        onStudentsEnrolledClick={vi.fn()}
        onActiveLast7DaysClick={vi.fn()}
        onAtRiskClick={vi.fn()}
        onLessonCoverageClick={onLessonCoverageClick}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lesson coverage 4/6, completed by at least 50% of students. View lesson details.',
      }),
    );

    expect(onLessonCoverageClick).toHaveBeenCalledTimes(1);
  });
});
