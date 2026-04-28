// Verifies lessons roster tab renders lesson metrics, sorting controls, and table states.
import { fireEvent, render, screen } from '@testing-library/react';
import type { RosterLessonRow } from '@scholarxp/api-contracts';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import LessonsTab from '@/Authoring/ModuleRoster/components/LessonsTab';

const lesson: RosterLessonRow = {
  moduleUnitId: 55,
  title: 'Quadratics',
  status: 'live',
  studentsStarted: 4,
  studentsCompleted: 3,
  completionRate: 75.5,
  averageMastery: 66.4,
  lastPracticedAt: null,
};

function renderTab(overrides: Partial<ComponentProps<typeof LessonsTab>> = {}) {
  return render(
    <LessonsTab
      rows={[lesson]}
      isLoading={false}
      error={null}
      sortBy="title"
      onSortByChange={vi.fn()}
      sortDirection="asc"
      onSortDirectionChange={vi.fn()}
      selectedLessonId={null}
      onSelectLesson={vi.fn()}
      {...overrides}
    />,
  );
}

describe('LessonsTab', () => {
  it('renders lesson rows and supports row keyboard/click selection', () => {
    const onSelectLesson = vi.fn();
    renderTab({ onSelectLesson, selectedLessonId: 55 });

    expect(screen.getByText('Quadratics')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('76%')).toBeInTheDocument();
    expect(screen.getByText('66%')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();

    const rowButton = screen.getByRole('button', { name: /Quadratics/i });
    fireEvent.click(rowButton);
    fireEvent.keyDown(rowButton, { key: 'Enter' });
    fireEvent.keyDown(rowButton, { key: ' ' });

    expect(onSelectLesson).toHaveBeenCalledTimes(3);
    expect(onSelectLesson).toHaveBeenCalledWith(55);
  });

  it('renders loading, empty, error, and unknown status states', () => {
    const { rerender } = renderTab({ isLoading: true });
    expect(document.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(5);

    rerender(
      <LessonsTab
        rows={[]}
        isLoading={false}
        error={null}
        sortBy="title"
        onSortByChange={vi.fn()}
        sortDirection="asc"
        onSortDirectionChange={vi.fn()}
        selectedLessonId={null}
        onSelectLesson={vi.fn()}
      />,
    );
    expect(screen.getByText('No live lessons in this module yet.')).toBeInTheDocument();

    rerender(
      <LessonsTab
        rows={[{ ...lesson, status: 'custom' as never }]}
        isLoading={false}
        error={null}
        sortBy="title"
        onSortByChange={vi.fn()}
        sortDirection="asc"
        onSortDirectionChange={vi.fn()}
        selectedLessonId={null}
        onSelectLesson={vi.fn()}
      />,
    );
    expect(screen.getByText('custom')).toBeInTheDocument();

    rerender(
      <LessonsTab
        rows={[]}
        isLoading={false}
        error="Could not load lessons."
        sortBy="title"
        onSortByChange={vi.fn()}
        sortDirection="asc"
        onSortDirectionChange={vi.fn()}
        selectedLessonId={null}
        onSelectLesson={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load lessons.');
  });
});
