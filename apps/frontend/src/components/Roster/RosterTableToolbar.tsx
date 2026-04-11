// Reusable filter/sort toolbar for roster tab tables; renders filter chips and a sort dropdown.
import type { SortDirection } from '@scholarxp/api-contracts';
import styles from './RosterTableToolbar.module.css';

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type SortOption<T extends string> = {
  value: T;
  label: string;
};

type RosterTableToolbarProps<F extends string, S extends string> = {
  filters?: FilterOption<F>[];
  activeFilter?: F;
  onFilterChange?: (filter: F) => void;
  sortOptions: SortOption<S>[];
  activeSortBy: S;
  onSortByChange: (sortBy: S) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (dir: SortDirection) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export default function RosterTableToolbar<F extends string, S extends string>({
  filters,
  activeFilter,
  onFilterChange,
  sortOptions,
  activeSortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
}: RosterTableToolbarProps<F, S>) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Table controls">
      {filters && onFilterChange && (
        <div className={styles.filters} role="group" aria-label="Filters">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`${styles.filterChip} ${activeFilter === f.value ? styles.filterChipActive : ''}`}
              onClick={() => onFilterChange(f.value)}
              aria-pressed={activeFilter === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.sortGroup}>
        <label className={styles.sortLabel} htmlFor="roster-sort-select">
          Sort by
        </label>
        <select
          id="roster-sort-select"
          className={styles.sortSelect}
          value={activeSortBy}
          onChange={(e) => onSortByChange(e.target.value as S)}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.directionToggle}
          onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
          aria-label={`Sort direction: ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to toggle.`}
          title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDirection === 'asc' ? '\u2191' : '\u2193'}
        </button>
      </div>

      {onSearchChange !== undefined && (
        <input
          type="search"
          className={styles.searchInput}
          value={searchValue ?? ''}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      )}
    </div>
  );
}
