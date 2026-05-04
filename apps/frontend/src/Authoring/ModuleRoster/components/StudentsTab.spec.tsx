// Verifies students roster tab renders table states and row/remove interactions.
import { fireEvent, render, screen } from '@testing-library/react';
import type { RosterStudentRow } from '@scholarxp/api-contracts';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import StudentsTab from '@/Authoring/ModuleRoster/components/StudentsTab';

vi.mock('@/Rewards/components/ProficiencyBadge', () => ({
  ProficiencyBadge: ({ level }: { level: number }) => <span>badge-{level}</span>,
}));

const row: RosterStudentRow = {
  studentId: 34,
  fullName: 'Ada Student',
  avatarUrl: 'default.png',
  moduleLevel: 4,
  currentXp: 140,
  completedLessons: 2,
  totalLiveLessons: 5,
  averageMastery: 72.4,
  dailyPracticeStatus: 'available',
  lastDailyPracticeCompletedAt: null,
  lastActivityAt: '2026-04-20T12:00:00.000Z',
  enrolledAt: '2026-04-01T12:00:00.000Z',
  enrolledVia: 'invite',
  isAtRisk: true,
};

function renderTab(overrides: Partial<ComponentProps<typeof StudentsTab>> = {}) {
  return render(
    <StudentsTab
      rows={[row]}
      isLoading={false}
      error={null}
      filter="all"
      onFilterChange={vi.fn()}
      sortBy="name"
      onSortByChange={vi.fn()}
      sortDirection="asc"
      onSortDirectionChange={vi.fn()}
      search=""
      onSearchChange={vi.fn()}
      selectedStudentId={null}
      onSelectStudent={vi.fn()}
      canRemoveStudents
      onRequestRemoveStudent={vi.fn()}
      {...overrides}
    />,
  );
}

describe('StudentsTab', () => {
  it('renders row data and supports row keyboard/click selection', () => {
    const onSelectStudent = vi.fn();
    renderTab({ onSelectStudent, selectedStudentId: 34 });

    expect(screen.getByText('Ada Student')).toBeInTheDocument();
    expect(screen.getByText('badge-4')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();

    const rowButton = screen
      .getAllByRole('button', { name: /Ada Student/i })
      .find((element) => element.tagName === 'TR')!;
    fireEvent.click(rowButton);
    fireEvent.keyDown(rowButton, { key: 'Enter' });
    fireEvent.keyDown(rowButton, { key: ' ' });

    expect(onSelectStudent).toHaveBeenCalledTimes(3);
    expect(onSelectStudent).toHaveBeenCalledWith(34);
  });

  it('stops remove button clicks from toggling the row drilldown', () => {
    const onSelectStudent = vi.fn();
    const onRequestRemoveStudent = vi.fn();
    renderTab({ onSelectStudent, onRequestRemoveStudent });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ada Student from module' }));

    expect(onRequestRemoveStudent).toHaveBeenCalledWith(row);
    expect(onSelectStudent).not.toHaveBeenCalled();
  });

  it('renders loading, empty, error, and no-action-column states', () => {
    const { rerender } = renderTab({ isLoading: true });
    expect(document.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(5);

    rerender(
      <StudentsTab
        rows={[]}
        isLoading={false}
        error={null}
        filter="all"
        onFilterChange={vi.fn()}
        sortBy="name"
        onSortByChange={vi.fn()}
        sortDirection="asc"
        onSortDirectionChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        selectedStudentId={null}
        onSelectStudent={vi.fn()}
        canRemoveStudents={false}
        onRequestRemoveStudent={vi.fn()}
      />,
    );
    expect(screen.getByText('No students match the current filter.')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();

    rerender(
      <StudentsTab
        rows={[]}
        isLoading={false}
        error="Could not load students."
        filter="all"
        onFilterChange={vi.fn()}
        sortBy="name"
        onSortByChange={vi.fn()}
        sortDirection="asc"
        onSortDirectionChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        selectedStudentId={null}
        onSelectStudent={vi.fn()}
        canRemoveStudents={false}
        onRequestRemoveStudent={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load students.');
  });
});
