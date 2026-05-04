// Verifies roster table toolbar renders optional filters, sort controls, and search input.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RosterTableToolbar from '@/Authoring/ModuleRoster/components/RosterTableToolbar';

describe('RosterTableToolbar', () => {
  it('changes filters, sort, direction, and search text', () => {
    const onFilterChange = vi.fn();
    const onSortByChange = vi.fn();
    const onSortDirectionChange = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <RosterTableToolbar
        filters={[{ value: 'all', label: 'All' }, { value: 'at_risk', label: 'At Risk' }]}
        activeFilter="all"
        onFilterChange={onFilterChange}
        sortOptions={[{ value: 'name', label: 'Name' }, { value: 'last_activity', label: 'Recent Activity' }]}
        activeSortBy="name"
        onSortByChange={onSortByChange}
        sortDirection="asc"
        onSortDirectionChange={onSortDirectionChange}
        searchValue=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Search students..."
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'At Risk' }));
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'last_activity' } });
    fireEvent.click(screen.getByRole('button', { name: /Sort direction: ascending/i }));
    fireEvent.change(screen.getByLabelText('Search students...'), { target: { value: 'ada' } });

    expect(onFilterChange).toHaveBeenCalledWith('at_risk');
    expect(onSortByChange).toHaveBeenCalledWith('last_activity');
    expect(onSortDirectionChange).toHaveBeenCalledWith('desc');
    expect(onSearchChange).toHaveBeenCalledWith('ada');
  });

  it('omits filters and search when callbacks are not supplied', () => {
    render(
      <RosterTableToolbar
        sortOptions={[{ value: 'title', label: 'Title' }]}
        activeSortBy="title"
        onSortByChange={vi.fn()}
        sortDirection="desc"
        onSortDirectionChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('group', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sort direction: descending/i })).toBeInTheDocument();
  });
});
