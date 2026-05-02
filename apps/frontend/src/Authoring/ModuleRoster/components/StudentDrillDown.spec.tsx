// Verifies student drilldown renders loading, error, empty, and populated detail states.
import { fireEvent, render, screen } from '@testing-library/react';
import type { RosterStudentDetailResponse } from '@scholarxp/api-contracts';
import { describe, expect, it, vi } from 'vitest';
import StudentDrillDown from '@/Authoring/ModuleRoster/components/StudentDrillDown';

const detail: RosterStudentDetailResponse = {
  student: {
    studentId: 34,
    fullName: 'Ada Student',
    avatarUrl: 'default.png',
    enrolledAt: '2026-04-01T12:00:00.000Z',
    enrolledVia: 'invite',
    moduleLevel: 4,
    currentXp: 100,
    completedLessons: 2,
    totalLiveLessons: 5,
    averageMastery: 70,
    dailyPracticeStatus: 'available',
    lastActivityAt: null,
  },
  lessonProgress: [
    {
      moduleUnitId: 55,
      lessonTitle: 'Quadratics',
      isCompleted: true,
      currentMasteryScore: 88.8,
      completedAt: '2026-04-02T12:00:00.000Z',
      lastPracticedAt: null,
    },
  ],
  recentPerformance: {
    accuracyLast7Days: null,
    averageTimeMsLast7Days: 1234,
    hintsUsedLast7Days: null,
  },
};

describe('StudentDrillDown', () => {
  it('renders error and close action', () => {
    const onClose = vi.fn();
    render(<StudentDrillDown detail={undefined} isLoading={false} error="Failed." onClose={onClose} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed.');
    fireEvent.click(screen.getByRole('button', { name: 'Close student detail' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders skeleton while loading or missing detail', () => {
    render(<StudentDrillDown detail={undefined} isLoading error={null} onClose={vi.fn()} />);

    expect(screen.getByText('Student Detail')).toBeInTheDocument();
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders populated student detail and recent performance fallbacks', () => {
    render(<StudentDrillDown detail={detail} isLoading={false} error={null} onClose={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Details for Ada Student' })).toBeInTheDocument();
    expect(screen.getByText('Quadratics')).toBeInTheDocument();
    expect(screen.getByText('89%')).toBeInTheDocument();
    expect(screen.getByText('1.2s')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
  });

  it('renders empty lesson progress when no lesson rows are present', () => {
    render(
      <StudentDrillDown
        detail={{ ...detail, lessonProgress: [] }}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('No lesson progress yet.')).toBeInTheDocument();
  });
});
