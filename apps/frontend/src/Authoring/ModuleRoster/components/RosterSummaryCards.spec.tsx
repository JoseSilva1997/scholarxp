// Verifies roster summary cards show the lesson coverage threshold copy tutors rely on for quick module health checks.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RosterSummaryResponse } from '@scholarxp/api-contracts';
import RosterSummaryCards from '@/Authoring/ModuleRoster/components/RosterSummaryCards';

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
  it('renders skeleton cards while summary is loading and nothing when no summary is available', () => {
    const { container, rerender } = render(
      <RosterSummaryCards
        summary={null}
        isLoading
        onStudentsEnrolledClick={vi.fn()}
        onActiveLast7DaysClick={vi.fn()}
        onAtRiskClick={vi.fn()}
        onLessonCoverageClick={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Loading roster summary')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);

    rerender(
      <RosterSummaryCards
        summary={null}
        isLoading={false}
        onStudentsEnrolledClick={vi.fn()}
        onActiveLast7DaysClick={vi.fn()}
        onAtRiskClick={vi.fn()}
        onLessonCoverageClick={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Roster summary')).not.toBeInTheDocument();
  });

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
    const onStudentsEnrolledClick = vi.fn();
    const onActiveLast7DaysClick = vi.fn();
    const onAtRiskClick = vi.fn();
    const onLessonCoverageClick = vi.fn();

    render(
      <RosterSummaryCards
        summary={summary}
        isLoading={false}
        onStudentsEnrolledClick={onStudentsEnrolledClick}
        onActiveLast7DaysClick={onActiveLast7DaysClick}
        onAtRiskClick={onAtRiskClick}
        onLessonCoverageClick={onLessonCoverageClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /students enrolled/i }));
    fireEvent.click(screen.getByRole('button', { name: /active in last 7 days/i }));
    fireEvent.click(screen.getByRole('button', { name: /at-risk students/i }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Lesson coverage 4/6, completed by at least 50% of students. View lesson details.',
      }),
    );

    expect(onStudentsEnrolledClick).toHaveBeenCalledTimes(1);
    expect(onActiveLast7DaysClick).toHaveBeenCalledTimes(1);
    expect(onAtRiskClick).toHaveBeenCalledTimes(1);
    expect(onLessonCoverageClick).toHaveBeenCalledTimes(1);
  });

  it('renders zero lesson coverage when there are no live lessons', () => {
    render(
      <RosterSummaryCards
        summary={{
          ...summary,
          atRiskCount: 0,
          lessonCoverage: {
            totalLiveLessons: 0,
            lessonsStartedByAtLeastOneStudent: 0,
            lessonsCompletedByAtLeastHalfOfStudents: 0,
          },
        }}
        isLoading={false}
        onStudentsEnrolledClick={vi.fn()}
        onActiveLast7DaysClick={vi.fn()}
        onAtRiskClick={vi.fn()}
        onLessonCoverageClick={vi.fn()}
      />,
    );

    expect(screen.getByText('0/0')).toBeInTheDocument();
  });
});
