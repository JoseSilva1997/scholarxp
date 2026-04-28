// Verifies student profile lifetime stats derive lesson totals from module aggregates.
import { render, screen } from '@testing-library/react';
import type { StudentProfileResponse } from '@scholarxp/api-contracts';
import { describe, expect, it } from 'vitest';
import StatsSection from '@/Account/Profile/components/StudentProfile/StatsSection';

const profile = {
  questHistorySummary: { totalCompleted: 1200, perfectDays: 8 },
  modules: [
    { completedLessons: 2 },
    { completedLessons: 3 },
  ],
} as StudentProfileResponse;

describe('StatsSection', () => {
  it('renders available stats and coming-soon placeholders', () => {
    render(<StatsSection profile={profile} />);

    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('Perfect Days')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Modules in Progress')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(3);
  });
});
