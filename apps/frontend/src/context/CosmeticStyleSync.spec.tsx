// Verifies non-theme cosmetics sync into root data attributes and defaults remove stale values.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CosmeticStyleSync } from '@/context/CosmeticStyleSync';
import { useCosmetics } from '@/Rewards/cosmetics';

vi.mock('@/Rewards/cosmetics', () => ({
  useCosmetics: vi.fn(),
}));

describe('CosmeticStyleSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-xp-color');
    document.documentElement.removeAttribute('data-bg');
    document.documentElement.removeAttribute('data-user-badge');
    document.documentElement.removeAttribute('data-badge-overlay');
  });

  it('writes equipped non-default cosmetic ids to root attributes', () => {
    vi.mocked(useCosmetics).mockReturnValue({
      cosmetic: (slot: string) => ({
        expBarColor: 'gold',
        background: 'scholar',
        userBadge: 'ornate',
        userBadgeOverlay: 'spark',
      })[slot],
    } as never);

    render(<CosmeticStyleSync />);

    expect(document.documentElement).toHaveAttribute('data-xp-color', 'gold');
    expect(document.documentElement).toHaveAttribute('data-bg', 'scholar');
    expect(document.documentElement).toHaveAttribute('data-user-badge', 'ornate');
    expect(document.documentElement).toHaveAttribute('data-badge-overlay', 'spark');
  });

  it('removes attributes for default, standard, none, or empty values', () => {
    document.documentElement.setAttribute('data-xp-color', 'gold');
    document.documentElement.setAttribute('data-bg', 'scholar');
    document.documentElement.setAttribute('data-user-badge', 'ornate');
    document.documentElement.setAttribute('data-badge-overlay', 'spark');
    vi.mocked(useCosmetics).mockReturnValue({
      cosmetic: (slot: string) => ({
        expBarColor: 'default',
        background: 'standard',
        userBadge: 'none',
        userBadgeOverlay: '',
      })[slot],
    } as never);

    render(<CosmeticStyleSync />);

    expect(document.documentElement).not.toHaveAttribute('data-xp-color');
    expect(document.documentElement).not.toHaveAttribute('data-bg');
    expect(document.documentElement).not.toHaveAttribute('data-user-badge');
    expect(document.documentElement).not.toHaveAttribute('data-badge-overlay');
  });
});
