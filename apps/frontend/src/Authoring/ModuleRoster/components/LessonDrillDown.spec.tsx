// Verifies lesson drilldown renders student progress, question-health tables, toggles, and empty states.
import { fireEvent, render, screen } from '@testing-library/react';
import type { LessonDrilldownResponse } from '@scholarxp/api-contracts';
import { describe, expect, it, vi } from 'vitest';
import LessonDrillDown from '@/Authoring/ModuleRoster/components/LessonDrillDown';

const detail: LessonDrilldownResponse = {
  moduleUnitId: 55,
  lessonTitle: 'Quadratics',
  students: [
    {
      studentId: 34,
      fullName: 'Ada Student',
      avatarUrl: null,
      isCompleted: true,
      masteryScore: 87.5,
      lastPracticedAt: null,
    },
  ],
  questionHealth: {
    strugglingQuestions: [
      {
        questionId: 1,
        questionTitle: 'Factor x^2',
        firstAttemptAccuracy: 45,
        overallAccuracy: 70.5,
        totalAttempts: 9,
      },
    ],
    variantDiscrepancies: [
      {
        questionId: 2,
        questionTitle: 'Variant factor',
        coreAccuracy: 90,
        coreAttempts: 10,
        variantLabel: 'B',
        variantAccuracy: 60,
        variantAttempts: 5,
        delta: -30,
      },
    ],
    highHintUsage: [
      {
        questionId: 3,
        questionTitle: 'Hint heavy',
        hintUsageRate: 40.5,
        studentsWithHint: 2,
        totalStudents: 4,
      },
    ],
    slowQuestions: [
      {
        questionId: 4,
        questionTitle: 'Slow one',
        medianTimeSec: 12.5,
        lessonMedianTimeSec: 6,
        qualifyingAttempts: 8,
      },
    ],
  },
};

describe('LessonDrillDown', () => {
  it('renders error and loading states', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <LessonDrillDown detail={undefined} isLoading={false} error="Failed." onClose={onClose} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed.');
    fireEvent.click(screen.getByRole('button', { name: 'Close lesson detail' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<LessonDrillDown detail={undefined} isLoading error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Lesson Detail')).toBeInTheDocument();
  });

  it('renders populated lesson detail and collapsible sections', () => {
    render(<LessonDrillDown detail={detail} isLoading={false} error={null} onClose={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Details for Quadratics' })).toBeInTheDocument();
    expect(screen.getByText('Ada Student')).toBeInTheDocument();
    expect(screen.getByText('87.5%')).toBeInTheDocument();
    expect(screen.getByText('Factor x^2')).toBeInTheDocument();
    expect(screen.getByText('-30pp')).toBeInTheDocument();
    expect(screen.getByText('40.5%')).toBeInTheDocument();
    expect(screen.getByText('12.5s')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Students/i }));
    expect(screen.queryByText('Ada Student')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Question Health/i }));
    expect(screen.queryByText('Factor x^2')).not.toBeInTheDocument();
  });

  it('renders empty table messages for missing drilldown data', () => {
    render(
      <LessonDrillDown
        detail={{
          ...detail,
          students: [],
          questionHealth: {
            strugglingQuestions: [],
            variantDiscrepancies: [],
            highHintUsage: [],
            slowQuestions: [],
          },
        }}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('No enrolled students.')).toBeInTheDocument();
    expect(screen.getByText('No struggling questions identified.')).toBeInTheDocument();
    expect(screen.getByText('No significant core vs. variant discrepancies found.')).toBeInTheDocument();
    expect(screen.getByText('No questions with high hint usage.')).toBeInTheDocument();
    expect(screen.getByText('No unusually slow questions detected.')).toBeInTheDocument();
  });
});
