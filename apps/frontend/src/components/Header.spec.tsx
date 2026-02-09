// Verifies header branch rendering for authenticated and unauthenticated states.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';

vi.mock('./UserBadge', () => ({
  default: () => <div>user-badge</div>,
}));

describe('Header', () => {
  it('shows auth links when user is not present', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
  });

  it('shows user badge when user is present', () => {
    render(
      <MemoryRouter>
        <Header user={{ id: 1, firstName: 'A', lastName: 'B', email: 'a@b.com', globalRole: 'student', isVerified: true }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('user-badge')).toBeInTheDocument();
  });
});
