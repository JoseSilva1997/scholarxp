// Verifies landing route content renders key product messaging and feature highlights.
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/utils';
import Landing from './Landing';

describe('Landing route', () => {
  it('renders hero and feature highlight cards', () => {
    renderWithProviders(<Landing />);

    expect(
      screen.getByRole('heading', {
        name: /Practice a little every day\.\s*Remember a lot more\./,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Get started free/i })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(
      screen.getByText('Spaced repetition that adapts to you'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Quests and streaks that reward consistency'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Two XP tracks: proficiency and progression'),
    ).toBeInTheDocument();
  });
});
