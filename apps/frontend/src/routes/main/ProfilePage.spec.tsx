// Verifies ProfilePage placeholder content renders so the route remains covered until feature work lands.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProfilePage from './ProfilePage';

describe('ProfilePage route', () => {
  it('renders heading and placeholder copy', () => {
    render(<ProfilePage />);

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(
      screen.getByText('Profile settings and role info will live here in upcoming iterations.'),
    ).toBeInTheDocument();
  });
});
